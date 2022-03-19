import boto3
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

appstream_client = boto3.client('appstream')

def get_as_images(os, instance_type):

    images_dict={}

    response = appstream_client.describe_images( Type='PUBLIC', MaxResults=20 )
    results=response['Images']

    while "NextToken" in response:
        response = appstream_client.describe_images( Type='PUBLIC', MaxResults=20, NextToken=response["NextToken"] )
        all_images=response['Images']
        results.extend(response['Images'])

    for image in results:
        platform=image['Platform']
        image_builder_supported=image['ImageBuilderSupported']
        image_name=image['Name']

        if platform == os and image_builder_supported and (instance_type in image_name):
            release_date=image['PublicBaseImageReleasedDate']
            images_dict[image_name]=release_date.date()

    sorted_tuples = sorted(images_dict.items(), key=lambda item: item[1])
    selected_image=sorted_tuples[-1][0]

    sorted_dict = {k: v for k, v in sorted_tuples}

    return selected_image

def on_event(event, context):
    print(event)
    request_type = event['RequestType']
    if request_type == 'Create': return on_create(event)
    if request_type == 'Update': return on_update(event)
    if request_type == 'Delete': return on_delete(event)
    raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
    os = event['ResourceProperties']['OS']
    instance_type = event['ResourceProperties']['InstanceType']
    selected_image=get_as_images(os, instance_type)

    return { "Data": { "AS_Latest_Image": selected_image } }

def on_update(event):
    os = event['ResourceProperties']['OS']
    instance_type = event['ResourceProperties']['InstanceType']
    selected_image=get_as_images(os, instance_type)

    return { "Data": { "AS_Latest_Image": selected_image } }

def on_delete(event):
    return ""