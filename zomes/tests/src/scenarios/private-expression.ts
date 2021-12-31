import { localConductorConfig, installation, sleep } from '../common';

module.exports = (orchestrator) => {
    orchestrator.registerScenario("Test public expression", async (s, t) => {
        const [alice, bob] = await s.players([localConductorConfig, localConductorConfig]);
    
        // install your happs into the coductors and destructuring the returned happ data using the same
        // array structure as you created in your installation array.
        const [[alice_happ]] = await alice.installAgentsHapps(installation);
        const [[bob_happ]] = await bob.installAgentsHapps(installation);

        await s.shareAllNodes([alice, bob]);

        // Send private expression from alice to bob
        const privateExpression = await alice_happ.cells[0].call(
            "generic_expression",
            "send_private_expression",
            {
                to: bob_happ.agent,
                expression: { 
                    // data: `{
                    //     "productId": 3
                    // }`,
                    data: `{
                        "created_by": "1234",
                        "title": "The Event",
                        "description": "an event",
                        "start_time": "12345",
                        "end_time": "123456",
                        "location": "internet",
                        "invitees": ["1234"]
                    }`,
                    author: "did://alice",
                    timestamp: new Date().toISOString(),
                    proof: {
                        signature: "sig",
                        key: "key"
                    },
                }
            },
        );
        console.log("Sent private experssion: ", privateExpression);
        t.ok(privateExpression);

        // Send invalid private expression from alice to bob
        try {
            await alice_happ.cells[0].call(
                "generic_expression",
                "send_private_expression",
                {
                    to: bob_happ.agent,
                    expression: { 
                        // data: `{
                        //     "productId": "id"
                        // }`,
                        data: `{
                            "created_by": 1234,
                            "title": "The Event",
                            "description": "an event",
                            "start_time": "12345",
                            "end_time": "123456",
                            "location": "internet",
                            "invitees": ["1234"]
                        }`,
                        author: "did://alice",
                        timestamp: new Date().toISOString(),
                        proof: {
                            signature: "sig",
                            key: "key"
                        },
                    }
                },
            );
        } catch(err) {
            console.log("Got expected error: ", err);
            t.ok(err);
        }

        // Get private expressions
        const expressionsFromAll = await bob_happ.cells[0].call(
            "generic_expression",
            "inbox",
            {
                from: null,
                page_size: 10, page_number: 0
            }
        );
        console.log("Got private experssion from all: ", expressionsFromAll);
        t.equal(expressionsFromAll.length, 1);
        t.equal(expressionsFromAll[0].data.title, "The Event");

        // Get private expressions from alice
        const expressionsFromAlice = await bob_happ.cells[0].call(
            "generic_expression",
            "inbox",
            {
                from: "did://alice",
                page_size: 10, page_number: 0
            }
        );
        console.log("Got private experssion from Alice: ", expressionsFromAlice);
        t.equal(expressionsFromAlice.length, 1);
        t.equal(expressionsFromAlice[0].data.title, "The Event");

        // Get private expressions from charlie
        const expressionsFromCharlie = await bob_happ.cells[0].call(
            "generic_expression",
            "inbox",
            {
                from: "did://charlie",
                page_size: 10, page_number: 0
            }
        );
        console.log("Got private experssion from Charlie: ", expressionsFromCharlie);
        t.equal(expressionsFromCharlie.length, 0);
        
    });
}