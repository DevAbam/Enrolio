Send SMS
This operation is used to SEND SMS, SCHEDULE SMS and SEND SMS WITH DELIVERY WEBHOOK by specifying the action parameter in request.

1. SEND SMS
This operation is used to send SMS to a single phone number or multiple phone numbers.

2. SCHEDULE SMS
This operation is used to schedule SMS to a single phone number or multiple phone numbers.

3. SEND SMS WITH DELIVERY WEBHOOK
This operation is used to send SMS and request a delivery report using a delivery webhook. The system pushes the delivery status of the message to the webhook.

4. SEND SANDBOXED SMS
This operation is used to send a test SMS request to the system. You are not billed for this operation. Messages sent in a sandboxed environment are not forwarded to the mobile network providers for delivery. Sandbox messages can only be seen from the SMS history report. This is a great environment to test your application without any cost.

Authorizations:
api-key
header Parameters
api-key
required
string
Example: Xeeini34rnjfi334t
Request Body schema: application/json
sender
required
string [ 1 .. 11 ] characters
A Sender ID (from address) is the name or number that identifies the sender of an SMS message. Note that this field should be 11 characters max including space. Anything more than that will result in your messages failing.

recipients
required
Array of arrays
This parameter refers to the MOBILE NUMBER(S) to which to Send message to

message
required
string
Content of your message should go here. A one-page message = 160 character. A 200 characters messages will be 2 pages.

callback_url	
string
Callback URL
A URL that will be called to notify you about the status of the message to a particular number.

It must be a valid URL
The notification request to your url will have 2 query parameters, sms_id and status.
The sms_id is the unique id that is attached to a message in the response when a request is made with the callback_url. The sms_id is a 16 character unique identifier (UUID).
The status is the status of the message to phone number correlating to the sms_id has values such as DELIVERED, SUBMITTED, PROHIBITED, QUEUED, NOT_DELIVERED, EXPIRED.
Please make sure your URL is exempted from any pre-authorization/authentication in your application to avoid delivery notification failure.
scheduled_date	
string
In the case of scheduling an SMS request, you need to add the scheduled_date field to it. Its in the format 'Y-m-d H:i A'

use_case	
any
Enum: "promotional" "transactional"
This is used to determine whether the message is promotional or transactional. It also ensures that a sender ID registered for promotional messages is not used to send transactional messages, and vice versa. | Note: This applies only to Nigerian traffic.

sandbox	
boolean
This is used to send a test SMS request to the system. You are not billed for this operation. Messages sent in a sandboxed environment are not forwarded to the mobile network providers for delivery. Sandbox messages can only be seen from the SMS history report. This is a great environment to test your application without any cost.

Responses
200 OK
402 ERROR
403 ERROR
422 ERROR
500 ERROR

post
/api/v2/sms/send
Request samples
PayloadJAVAPYTHONPHPNODEJS
Content type
application/json
Example

SEND SMS
SEND SMS

Copy
Expand allCollapse all
{
"sender": "Arkesel",
"message": "Hello world. Spreading peace and joy only. Remember to put on your face mask. Stay safe!",
"recipients": [
"233544919953",
"233544919953"
]
}
Response samples
200402403422500
Content type
application/json
Example

SEND SMS
SEND SMS

Copy
Expand allCollapse all
{
"status": "success",
"data": [
{},
{},
{}
]
}


FOR CHECK BALANCE
get
/api/v2/clients/balance-details
Request samples
JAVAPYTHONPHPNODEJS

Copy
const axios = require('axios');

const config = {
  method: 'get',
  url: 'https://sms.arkesel.com/api/v2/clients/balance-details',
  headers: {
    'api-key': 'cE9QRUkdjsjdfjkdsj9kdiieieififiw='
  }
};

axios(config)
.then(function (response) {
  console.log(JSON.stringify(response.data));
})
.catch(function (error) {
  console.log(error);
});
Response samples
200500
Content type
application/json

Copy
Expand allCollapse all
{
"status": "success",
"data": {
"sms_balance": "2003",
"main_balance": "GHS 20.99"
}
}