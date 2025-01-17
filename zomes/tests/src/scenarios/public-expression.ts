import { localConductorConfig, installation, sleep } from '../common'

module.exports = (orchestrator) => {
    orchestrator.registerScenario("Test public expression", async (s, t) => {
        const [alice] = await s.players([localConductorConfig]);
    
        // install your happs into the coductors and destructuring the returned happ data using the same
        // array structure as you created in your installation array.
        const [[alice_common]] = await alice.installAgentsHapps(installation);
    
        // Create an expression
        let entryHash = await alice_common.cells[0].call(
            "generic_expression",
            "create_expression",
            { 
                // data: `{
                //     "productId": 1
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
            },
        );
        console.log("Got entry hash: ")
        console.log(entryHash);
        t.ok(entryHash);

        // Create an invalid expression
        try {
            await alice_common.cells[0].call(
                "generic_expression",
                "create_expression",
                { 
                    // data: `{
                    //     "productId": "1"
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
                },
            );
        } catch(err) {
            console.log("Got expected error: ", err);
            t.ok(err);
        }
    
        sleep(10000);
        
        // Get expression by author
        var from_date = new Date();
        var dateOffset = 12 * 60 * 60 * 1000;
        from_date.setTime(from_date.getTime() - dateOffset); // 12 hours ago
    
        const expressions = await alice_common.cells[0].call(
            "generic_expression",
            "get_expression_by_author",
            {
                author: "did://alice",
                from: from_date.toISOString(),
                until: new Date().toISOString()
            }
        );
        console.log("Got expressions by author: ", expressions);
        t.equal(expressions.length, 1);
        t.equal(expressions[0].data.title, "The Event");
        t.equal(expressions[0].author, "did://alice");
    
        // Get experssion by its address
        const expression = await alice_common.cells[0].call(
            "generic_expression",
            "get_expression_by_address",
            entryHash,
        )
        console.log("Got expression by address: ", expression);
        t.equal(expression.data.title, "The Event");
        t.equal(expression.author, "did://alice");
    
    });
}