const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  authorAddress: 'amir@javanshir.net',
  authorName: 'Amir Javanshir',
  cdkVersion: '2.16.0',
  defaultReleaseBranch: 'main',
  name: 'CustomResources',
  description: 'A CDK project for experimenting with CDK Custome Resources',
  repositoryUrl: 'https://github.com/ajavanshir/cdk-custom-resources.git',
  keywords: [
    'AWS CDK',
    'Custome Resources',
    'projen',
    'Typescript',
    'Deployment',
  ],

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();