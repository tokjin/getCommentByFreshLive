let dbName = 'fresh'; // DB名
let mongoUrl = 'mongodb://127.0.0.1:27017/' + dbName;
let freshApi = 'https://openapi.freshlive.tv/v1/comments';
let db,mainLoop,programId;
let loopCount = 0;

// コメントを取得する放送のprogramId（複数可）
let programList = [239912, 240353, 240653, 240654, 240655, 240853, 240852, 241064, 241748, 241998, 242291, 243338];

const { MongoClient } = require('mongodb');
const request = require('request');


MongoClient.connect(mongoUrl, { useNewUrlParser: true }, (err, client) => {
	if (err) throw err;
	db = client.db(dbName);
    
//  メインループのインターバルは、APIを叩く回数が60/m以下にならないといけない && コメント取得が終わる前に次のループが始まるとエラーになる ので多めに設定する。
    mainLoop = setInterval(getCommentLoop, 5000);
    getCommentLoop();
});

function getCommentLoop(){
    
    programId = programList[loopCount];
    loopCount++
    
    console.log('id:',programId+' / Start  (',loopCount,'/',programList.length,')');
    
    // Promiseの定義
    function freshApiPush(Lastmillisecond) {
        return new Promise(function (resolve, reject) {
            
            request.get({
                uri: freshApi,
                headers: { 'Content-type': 'application/json' },
                qs: {
                    programId: programId,
                    limit: '500',
                    order: 'asc',
                    sinceMillisecond: Lastmillisecond
                },
                json: true
            }, function (err, req, json) {
                
                handleCheck(json); // コテハンのリストを作成しない場合は不要
                
                db.collection('comments').insertMany(json.data, function (err, result) {
                    if(err) reject();
                    if(json.data.length >= 500){
                        if(json.data[499].millisecond == json.meta.latestMillisecond) reject(); // 500ピッタリだったら止める
                        console.log('id:',programId,'/ +');
                        resolve(json.data[499].millisecond);
                    } else {
                        reject();
                    }
                });
            });
        });
    }
    
    // Promiseの開始
    freshApiPush('-600000').then(function(Lastmillisecond) {
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond);
    }).then(function(Lastmillisecond){
        return freshApiPush(Lastmillisecond); // とりあえず最大10回(5000コメント)
    }).catch(function(){
        console.log('id:',programId,'/ Finish (',loopCount,'/',programList.length,')');
        
        if(loopCount >= programList.length) {
            console.log('All Loop Finish (',programList.length,')');
            clearInterval(mainLoop);
            //client.close();
            process.exit();
        }
    });

}

function handleCheck(json){
    for(var i=0;i<json.data.length-1;i++){
        var handleName = '';
        let rawComment = json.data[i].raw;
        
        if(rawComment.match(/@/)){
            try{ handleName = rawComment.match(/@.+$/)[0].slice(1); }
            catch(e) { handleName = 'null' } // @だけとかの場合
        } else if(rawComment.match(/＠/)){
            try{ handleName = rawComment.match(/＠.+$/)[0].slice(1); }
            catch(e) { handleName = 'null' }
        } else continue;
        
        db.collection('handle').updateOne({userId: json.data[i].freshId}, {$set:{
            userId: json.data[i].freshId,
            handleName: handleName,
            updated_programId: json.data[i].programId
        }}, {upsert: true }, function (err, result) {
        });
        
    }
    
    return;
}
