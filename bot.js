// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {Activity, ActivityTypes, TurnContext, CardFactory } = require('botbuilder');
const validator = require('validator');
const jsonwebtoken = require('jsonwebtoken');
const config = require('config');
const moment  = require('moment');
const uuidv1 = require('uuid/v1');

let sockets = {};

let messengerURL = `http://${config.Services.messengerhost}`;
if (validator.isIP(config.Services.messengerhost))
    messengerURL = `http://${config.Services.messengerhost}:${config.Services.messengerport}`;

function onTurn(turnContext) {
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        if (turnContext && turnContext.activity &&turnContext.activity.from.id) {


            if(!sockets[turnContext.activity.from.id]) {
                //await turnContext.sendActivity(`You said '${ turnContext.activity.text }'`);
                let socket = require('socket.io-client')(messengerURL, {forceNew: true});
                sockets[turnContext.activity.from.id] = socket;
                let turnContextNew = new TurnContext(turnContext);
                //socket.turnContext = turnContext;
                socket.on('connect', function () {


                    let session_id = uuidv1();
                    // turnContext.userData = {
                    //    session_id : session_id
                    // };

                    let channel = "skype";
                    if( turnContextNew.activity.channelId){
                        channel = turnContextNew.activity.channelId;
                    }

                    var jwt = jsonwebtoken.sign({
                        session_id: session_id,
                        iss: config.Host.iss,
                        iat: moment().add(1, 'days').unix(),
                        company: config.Host.company,
                        tenant: config.Host.tenant,
                        contact:turnContextNew.activity.from,
                        channel: channel,
                        jti: turnContextNew.activity.from.id,
                        attributes: ["60"],
                        priority: "0",
                        name: turnContextNew.activity.from.name,
                        //message: turnContextNew.activity,

                    }, config.Host.secret);

                    // setInterval(function(){
                    //     socket.emit("message", {
                    //         message: turnContextNew.activity.text,
                    //         type:"text" ,
                    //     });
                    // }, 1000);

                    socket
                        .emit('authenticate', {token: jwt}) //send the jwt
                        .on('authenticated', function () {
                            //do other things
                            turnContextNew.sendActivity("Please waiting for human agent to take over");

                            //retryAgent();

                            socket.on('agent', function(data){

                                if(retryObj) {
                                    clearInterval(retryObj);
                                }
                                console.log(data);
                                var card = createAnimationCard(data.name, data.avatar);
                                turnContextNew.sendActivity({ attachments: [card] });
                                socket.emit("agentfound");


                            });

                            socket.on('typing', function (data) {

                                let reply = {};
                                reply.Type = ActivityTypes.Typing;
                                reply.Text = null;
                                turnContextNew.sendActivity(reply);



                            });

                            socket.on('typingstoped', function (data) {

                            });

                            socket.on('seen', function (data) {

                            });

                            socket.on("message", function(data){

                                if(data.type == 'link' && data.mediaType && data.mediaName){

                                    try {
                                        var attachment = {
                                            contentUrl: data.message,
                                            contentType: data.mediaType,
                                            name: data.mediaName
                                        };
                                        turnContextNew.sendActivity({attachments: [attachment]});
                                    }catch(ex){
                                        console.log(ex);
                                    }


                                }else {
                                    turnContextNew.sendActivity(data.message);
                                }

                            });

                            socket.on("ticket", function(data){

                                console.log(data);
                                var card = createTicketCard(session,data.subject,data.reference,data.type, data.prority ,data.tags);
                                turnContextNew.sendActivity({ attachments: [card] });
                            });

                            socket.on('existingagent', function(data){

                                if(retryObj){

                                    clearInterval(retryObj);
                                }

                                if(data && data.name && data.avatar) {
                                    console.log(data);
                                    var card = createAnimationCard( data.name, data.avatar);
                                    turnContextNew.sendActivity({ attachments: [card] });
                                }

                            });

                            socket.on('left', function(data){

                                turnContextNew.sendActivity("Agent left the chat");


                                if(sockets[turnContextNew.activity.from.id]) {
                                    //session.beginDialog('/csat');
                                    delete sockets[turnContextNew.activity.from.id];
                                }
                                if(retryObj){

                                    clearInterval(retryObj);
                                }
                                socket.disconnect();

                            });

                            socket.on('disconnect', function () {

                                //session.send("Agent left the chat due to technical issue...");

                                if(sockets[turnContextNew.activity.from.id]) {
                                    //session.endConversation();
                                    delete sockets[turnContextNew.activity.from.id];
                                }
                                if(retryObj){

                                    clearInterval(retryObj);
                                }

                            });

                            function retryAgent () {

                                socket.emit("retryagent");
                            }

                            var retryObj = setInterval(retryAgent, 30000);

                            if (turnContextNew.activity.attachments && turnContextNew.activity.attachments.length > 0) {


                                //var attachment = msg.attachments[0];
                                //var fileDownload = checkRequiresToken(msg)
                                //    ? requestWithToken(attachment.contentUrl)
                                //    : request(attachment.contentUrl);
                                //
                                //fileDownload.then(
                                //    function (response) {
                                //
                                //        // Send reply with attachment type & size
                                //        var reply = new builder.Message(session)
                                //            .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, response.length);
                                //        session.send(reply);
                                //
                                //
                                //
                                //    }).catch(function (err) {
                                //    console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
                                //});

                                console.log(turnContextNew.activity.attachments);

                                turnContextNew.activity.attachments.forEach(function(item) {
                                    var msg = {
                                        message: item.contentUrl,
                                        mediaType: item.contentType,
                                        //mediaToken:obtainToken(),
                                        link: item.contentUrl,
                                        type: "text",
                                    };

                                    console.log(msg);

                                    sockets[turnContextNew.activity.from.id].emit("message", msg);
                                });


                            }else{

                                socket.emit("message", {
                                    message: turnContextNew.activity.text,
                                    type:"text" ,
                                });
                            }

                        })
                        .on('unauthorized', function (msg) {
                            console.log("unauthorized: " + JSON.stringify(msg.data));
                            delete sockets[turnContextNew.activity.from.id];
                            //throw new Error(msg.data.type);
                        })

                });

            }else{
                if (turnContext.activity.attachments && turnContext.activity.attachments.length > 0) {


                    //var attachment = msg.attachments[0];
                    //var fileDownload = checkRequiresToken(msg)
                    //    ? requestWithToken(attachment.contentUrl)
                    //    : request(attachment.contentUrl);
                    //
                    //fileDownload.then(
                    //    function (response) {
                    //
                    //        // Send reply with attachment type & size
                    //        var reply = new builder.Message(session)
                    //            .text('Attachment of %s type and size of %s bytes received.', attachment.contentType, response.length);
                    //        session.send(reply);
                    //
                    //
                    //
                    //    }).catch(function (err) {
                    //    console.log('Error downloading attachment:', { statusCode: err.statusCode, message: err.response.statusMessage });
                    //});

                    console.log(turnContext.activity.attachments);

                    turnContext.activity.attachments.forEach(function(item) {
                        var msg = {
                            message: item.contentUrl,
                            mediaType: item.contentType,
                            //mediaToken:obtainToken(),
                            link: item.contentUrl,
                            type: "text",
                        };

                        console.log(msg);

                        sockets[turnContext.activity.from.id].emit("message", msg);
                    });


                }else{

                    sockets[turnContext.activity.from.id].emit("message", {
                        message: turnContext.activity.text,
                        type:"text" ,
                    });
                }
            }

        } else {

            turnContext.sendActivity(`[${ turnContext.activity.type } event detected]`);
        }

}


function createAnimationCard( name, avatar) {
    // return new builder.ThumbnailCard(session)
    //     .title('Agent found')
    //     .subtitle(name)
    //     .text("Agents greeting can be added !!!!!!!!!!")
    //     .images([builder.CardImage.create(session, avatar)]);

    return CardFactory.thumbnailCard(
        'Agent found !!!!',
        [{ url: avatar}],
        [{}],
        {
            subtitle: name,
            text: 'Agents greeting can be added !!!!!!!!!!'
        }
    );

};

function createCSATCard(session, name, avatar) {
    return new builder.ThumbnailCard(session)
        .title('customer satisfaction survey')
        .subtitle(name)
        .text("Are you satisfied with our service ?")
        .images([builder.CardImage.create(session, avatar)])
        .buttons([
            builder.CardAction.postBack(session, 'good', 'Satisfied'),
            builder.CardAction.postBack(session, 'bad', 'Not Satisfied')
        ]);
}

function createTicketCard(session, subject, reference,type,priority, tags){

    return new builder.ThumbnailCard(session)
        .title("New ticket has been created")
        .subtitle(subject)
        .subtitle(type)
        .subtitle(priority)
        .text("Your reference id is "+reference);

}

function CreateSubmission(session, requester, submitter, satisfaction,contact, cb){

    var token = util.format("Bearer %s",config.Host.token);
    if((config.Services && config.Services.csaturl && config.Services.csatport && config.Services.csatversion)) {


        //console.log("CreateSubmission start");
        var csatURL = util.format("http://%s/DVP/API/%s/CustomerSatisfaction/Submission/ByEngagement", config.Services.csaturl, config.Services.csatversion);
        if (validator.isIP(config.Services.csaturl))
            csatURL = util.format("http://%s:%d/DVP/API/%s/CustomerSatisfaction/Submission/ByEngagement", config.Services.csaturl, config.Services.csatport, config.Services.csatversion);

        var csatData =  {

            requester: requester,
            submitter: submitter,
            engagement: session,
            method:'chat',
            satisfaction: satisfaction,
            contact: contact


        };



        // logger.debug("Calling CSAT service URL %s", ticketURL);
        // logger.debug(csatData);

        request({
            method: "POST",
            url: csatURL,
            headers: {
                authorization: token,
                companyinfo: util.format("%d:%d", config.Host.tenant, config.Host.company)
            },
            json: csatData
        }, function (_error, _response, datax) {


            try {

                console.log(_response.body);

                if (!_error && _response && _response.statusCode == 200 && _response.body && _response.body.IsSuccess) {

                    cb(true, _response.body.Result);

                }else{

                    // logger.error("There is an error in  create csat for this session "+ session);

                    cb(false, undefined);


                }
            }
            catch (excep) {

                //logger.error("There is an error in  create csat for this session "+ session, excep);
                cb(false, undefined);

            }
        });
    }
}


module.exports.onTurn = onTurn;
