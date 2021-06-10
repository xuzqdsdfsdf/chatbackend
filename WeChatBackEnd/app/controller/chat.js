'use strict';

const friend = require("./friend");

module.exports = app => {
   class Controller extends app.Controller {
      async connect() {
         const { ctx, app } = this;
         if (!ctx.websocket) {
            ctx.throw(400, '非法访问');
         }
         // console.log(`clients: ${app.ws.clients.size}`);

         // 监听接收消息和关闭socket
         ctx.websocket
            .on('message', msg => {
               // console.log('接收消息', msg);
            })
            .on('close', (code, reason) => {
               // 用户下线 
               console.log('用户下线', code);
               let user_id = ctx.websocket.user_id;
               // 查看该socket是否存在app.ws.user中
               if (app.ws.user && app.ws.user[user_id]) {
                  delete app.ws.user[user_id];
               }
            });
      }
      async send() {
         const { ctx, app, service } = this;
         // 参数校验
         ctx.validate({
            to_id: { type: 'int', required: true, desc: '接受消息人的id' },
            chat_type: { type: 'string', required: true, range: ['user', 'group'], desc: '接受类型' },
            type: { type: 'string', required: true, range: ['text', 'audio', 'image', 'video','card'], desc: '消息类型' },
            data: { type: 'string', required: true, desc: '消息内容' },
            options: { type: 'string', required: false, desc: '消息参数' }
         });
         //   获取参数
         let current_id = ctx.authuser.id;
         let { to_id, chat_type, type, data, options } = ctx.request.body;
         options = JSON.parse(options)
         // 单聊
         if (chat_type == 'user') {
            // 验证对方好友中的我是否存在切未被拉黑
            let friend = await app.model.Friend.findOne({
               where: {
                  user_id: to_id,
                  friend_id: current_id,
                  isblack: 0
               },
               include: [{
                  model: app.model.User,
                  as: 'userinfo'
               }, {
                  model: app.model.User,
                  as: 'friendinfo'
               }]
            })
            // friendinfo 因为是站在对方的角度所以friend_id是我,所以我是发送者
            // userinfo 因为是站在对方的角度所以user_id是对方的,所以是接受者
            if (!friend) {
               return ctx.throw(400, '用户不存在或已被拉黑')
            }
            // 验证好友是否被禁用
            if (!friend.userinfo.status) {
               return ctx.throw(400, '对方已被禁用')
            }
            let from_name = friend.nickname ? friend.nickname : friend.friendinfo.username
            // 构建消息格式
            let message = {
               id: (new Date().getTime()),
               from_avatar: friend.userinfo.avatar,
               from_name,
               from_id: friend.friendinfo.id,
               to_id,
               to_name: friend.nickname ? friend.nickname : friend.userinfo.username,
               to_avatar: friend.friendinfo.avatar,
               chat_type: 'user',
               type,
               data,
               options,//消息参数
               created_time: (new Date().getTime()),
               isremove: 0
            }
            let isupload = (message.type == 'video' || message.type == 'audio')
            if (isupload) {
               switch (message.type) {
                  case 'video':
                     message.options.poster = `${message.data}?x-oss-process=video/snapshot,t_10,m_fast,w_300,f_png`
                     break;
                  case 'audio':
                     message.options.time = options.time;
                     break;
               }
            }
            // 拿到对方的socket
            ctx.sendAndSaveMessage(message, to_id)
            return ctx.apiSuccess(JSON.stringify(message))
         } else {
            // 是否存在该群聊且未被封禁
            let group = await app.model.Group.findOne({
               where: {
                  id: to_id,
                  status: 1
               },
               include: [
                  {
                     model: app.model.GroupUser,
                     include: [
                        {
                           model: app.model.User,
                           as: 'group_user',
                           attributes: ['avatar']
                        }
                     ]
                  }
               ]
            })
            // 我是否在群聊中
            let isexist = await app.model.GroupUser.findOne({
               where: {
                  group_id: to_id,
                  user_id: current_id
               }
            })
            if (!group) return ctx.throw(400, '该群不存在或已被封禁')
            if (!isexist) return ctx.throw(400, '您不在该群聊中')
            // 组织消息格式
            let message = {
               id: (new Date().getTime()),
               from_avatar: ctx.authuser.avatar,
               from_name: ctx.authuser.nickname || ctx.authuser.username,
               from_id: current_id,
               to_id,
               to_name: group.name,
               to_avatar: group.avatar,
               chat_type: 'group',
               type,
               data,
               options,//消息参数
               created_time: (new Date().getTime()),
               isremove: 0,
               group,
               options
            }
            let isupload = (message.type == 'video' || message.type == 'audio')
            if (isupload) {
               switch (message.type) {
                  case 'video':
                     message.options.poster = `${message.data}?x-oss-process=video/snapshot,t_10,m_fast,w_300,f_png`
                     break;
                  case 'audio':
                     message.options.time = options.time;
                     break;
               }
            }
            // 发送消息
            group.group_users.forEach(v => {
               if (v.user_id !== current_id) {
                  ctx.sendAndSaveMessage(message, v.user_id)
               }
            })
            ctx.apiSuccess(JSON.stringify(message))
            // 
         }
         // 返回成功

      }
      async getdisconnectMessage() {
         const { app, service, ctx } = this;
         let current_id = ctx.authuser.id;
         // 获取离线消息
         let res = await service.cache.getList(`getmessage_${current_id}`);
         // 清除离线消息 
         await service.cache.remove(`getmessage_${current_id}`)
         if(res.length)
         {
            res.forEach(message => {
               message = JSON.parse(message)
               ctx.sendAndSaveMessage(message.message, current_id,message.msg);
            })
         }
      }
      async recall() {
         // 参数校验
         const { app, ctx } = this;
         let current_id = ctx.authuser.id;
         ctx.validate({
            id: { type: 'int', required: true, desc: '对象群/用户id' },
            message_id: { type: 'int', required: true, desc: '消息id' },
            chat_type: { type: 'string', required: true, desc: '消息类型', range: ['group', 'user'] },
         })
         // 聊天类型判断
         let { id, message_id, chat_type } = ctx.request.body;
         let message = {
            from_id:current_id,
            id, //对象/群id
            chat_type,//聊天类型
            created_time: (new Date().getTime()),//时间
            message_id, //消息id
            isremove: 1, //撤回
            type:'system'
         }
         // 单聊
         let group = await app.model.Group.findOne({
            where:{
               id,
               status:1
            },
            include:[
               {
                  model:app.model.GroupUser,
                  attributes:['user_id','nickname']
               }
            ]
         })
         if (chat_type == 'user') {
            ctx.sendAndSaveMessage(message, id,'recall')
         } else {
            // 群聊
            if(!group)return ctx.throw(400,'该群不存在')
            group.group_users.forEach(v=>{
               if(v.user_id !== current_id)
               {
                  ctx.sendAndSaveMessage(message,v.user_id,'recall')
               }
            })
         }
         ctx.apiSuccess(JSON.stringify(message))
         // 
      }
   }
   return Controller;
};
