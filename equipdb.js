mongoClient.connect(dbUrl, function(err, client) {
    if (err) throw err;
    var db = client.db("test")
    
    var dbo = db.db('test')
    var myObj = { assetNum: 0, category: 1 };
    dbo.collection("test").insertOne(myObj, function(err, res) {
        if (err) throw err;
        console.log("1 document inserted");
        db.close();
    });
});