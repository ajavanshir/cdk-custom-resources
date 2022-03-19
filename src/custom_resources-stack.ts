import { App, Stack, StackProps, CfnOutput, Environment, Duration, CustomResource } from 'aws-cdk-lib'
import { SecurityGroup, SubnetType, IVpc, Subnet } from 'aws-cdk-lib/aws-ec2'
import * as utils from '../lib/utils';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

interface SSMStackProps extends StackProps {
    env: Environment,
    prefix: string,
    vpc: IVpc
}

export class SSMStack extends Stack {

    constructor(scope: App, id: string, props: SSMStackProps) {
        super(scope, id, props);

        const getImage = new cr.AwsCustomResource(this, 'list-of-images', {
            onCreate: {
                service: 'AppStream',
                action: 'describeImages',
                parameters: {
                    Type: "PUBLIC"
                },
                physicalResourceId: cr.PhysicalResourceId.fromResponse(''),
                outputPaths: ["Images.0.Name"],
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE
            })
        });

        const imageName = getImage.getResponseField("Images.0.Name");

        //------------------------------------------------------------------
        // Create the IAM Policies and Role for Lambda
        //------------------------------------------------------------------
        let lambdaInlinePolicyStatement1 = new iam.PolicyStatement({ effect: iam.Effect.ALLOW, sid: "lambdaInlinePolicy1"});
        lambdaInlinePolicyStatement1.addActions("appstream:DescribeImageBuilders", "appstream:DescribeImages");
        lambdaInlinePolicyStatement1.addResources(`arn:aws:appstream:${props.env.region}:${props.env.account}:*`);

        let lambdaInlinePolicyStatement2 = new iam.PolicyStatement({ effect: iam.Effect.ALLOW, sid: "lambdaInlinePolicy2"});
        lambdaInlinePolicyStatement2.addActions("logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "ec2:DescribeInstances",
            "ec2:CreateNetworkInterface",
            "ec2:AttachNetworkInterface",
            "ec2:DescribeNetworkInterfaces",
            "ec2:DeleteNetworkInterface");

        //lambdaInlinePolicyStatement2.addResources(`arn:aws:ec2:${props.env.region}:${props.env.account}:subnet/${props.subnet}`);
        lambdaInlinePolicyStatement2.addResources("*");

        let lambdaInlinePolicy = new iam.PolicyDocument();
        lambdaInlinePolicy.addStatements(lambdaInlinePolicyStatement1)
        lambdaInlinePolicy.addStatements(lambdaInlinePolicyStatement2)

        let lambdaGetASImageRole = new iam.Role(this, 'LambdaCreateASImageRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: "Role for Lambda to create Appstream Images",
            roleName: props.prefix.concat("-LambdaCreateASImageRole"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ],
            inlinePolicies: {
                lambdaInlinePolicy: lambdaInlinePolicy
            }
        })

        //--------------------------------------------------------------------------
        // Create the Start Image Builder Lambda and associated Step function task
        //--------------------------------------------------------------------------
        const getLatestASImageLambda = new lambda.Function(this, 'getLatestASImageLambda', {
            runtime: lambda.Runtime.PYTHON_3_9,
            code: lambda.Code.fromAsset('lambda/ImageBuilder'),
            handler: 'getLatestASImage.on_event',
            timeout: Duration.seconds(120),
            description: 'Get the latest AS Base Image',
            role: lambdaGetASImageRole,
            vpc: props.vpc,
            vpcSubnets: {
                subnetGroupName: "PrivateSubnet"
            }
        });

        const myProvider = new cr.Provider(this, 'MyProvider', {
            onEventHandler: getLatestASImageLambda,
            providerFunctionName: 'getLatestASImage',
            vpc: props.vpc
        });

        const myConsumer = new CustomResource(this, 'CustomResourceAMIConsume', {
            serviceToken: myProvider.serviceToken,
            properties: {
                "OS": "WINDOWS_SERVER_2019",
                "InstanceType": "G4dn"
            }
        });

        const latestImageName = myConsumer.getAttString("AS_Latest_Image")

        // Create a new SSM Parameter holding a String
        new ssm.StringParameter(this, 'ASLatestImageStringParameter', {
            description: 'Latest AppStream Image for an ImageBuilder',
            parameterName: '/appstream/images/windows_2019/G4dn/latest',
            stringValue: latestImageName
        });

        const myConsumer2 = new CustomResource(this, 'CustomResourceAMIConsume2', {
            serviceToken: myProvider.serviceToken,
            properties: {
                "OS": "WINDOWS_SERVER_2019",
                "InstanceType": "AppStream-WinServer"
            }
        });

        const latestImageName2 = myConsumer2.getAttString("AS_Latest_Image")

        // Create a new SSM Parameter holding a String
        new ssm.StringParameter(this, 'ASLatestImageStringParameter2', {
            description: 'Latest AppStream Image for an ImageBuilder',
            parameterName: '/appstream/images/windows_2019/Standard/latest',
            stringValue: latestImageName2
        });

        // Grant read access to some Role
        // param.grantRead(role);
    }
}
