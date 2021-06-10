module.exports = {
    apiSuccess(data = '', msg = 'ok', code = 200) {
        this.status = code
        this.body = { data, msg }
    },
    // api返回失败
    apiFail(data = '', msg = 'ok', code = 200) {
        this.status = code
        this.body = { data, msg }
    },
    createtoken(value) {
        return this.app.jwt.sign(value, this.app.config.jwt.secret)
    },
    // 验证token的方法
    checktoken(token) {
        return this.app.jwt.verify(token, this.app.config.jwt.secret)
    },
    async sendAndSaveMessage(message, to_id, msg = 'ok') {
        const { app, service } = this;
        let current_id = this.authuser.id;
        let { chat_type } = message
        let message_to_id = message.to_id;
        // 此消息如果是群消息需要存到群列表中去
        if (chat_type == 'group') {
            service.cache.setList(`chatlog_${chat_type}_${message_to_id}`, message)
        }
        if (app.ws.user && app.ws.user[to_id]) {
            // 验证对方的socket是否存在?不在线，将消息存放到redis队列中等对方上线后发送：在线发送给对方
            // 存在对方的聊天记录
            // 对方在线 
            app.ws.user[to_id].send(JSON.stringify({message, msg }))
            // 存到对方历史记录中
            if (msg !== 'recall') {
                service.cache.setList(`chatlog_${to_id}_${chat_type}_${current_id}`, message)
            } 
        } else {
            // 不在线存储 
            if (msg == 'recall') {
                let list = await service.cache.getList('getmessage_' + to_id)
                let index = list.findIndex(v => {
                    v = JSON.parse(v)
                    console.log(v);
                    return v.message.chat_type == message.chat_type && v.message.id == message.message_id
                })
                console.log(index);
                if (index !== -1) {
                    let item = JSON.parse(list[index]);
                    item.message.isremove = 1;
                    service.cache.update('getmessage_' + to_id, index, item)
                }
            } else if(msg!=='newfriend') {
                service.cache.setList('getmessage_' + to_id, {message,msg})
            }
        }
        // 存储到我的历史记录中
        // 存储到自己的聊天记录中chatlog_当前用户id_user_对方用户id
        service.cache.setList(`chatlog_${current_id}_${chat_type}_${to_id}`,message)
    },
    // 获得唯一id
    genID(length) {
        return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
    },
    // 生成二维码
    getqrcode(data) {
        var img = require('qr-image').image(data, { size: 10 });
        this.response.type = 'image/png';
        this.body = img;
    }
}