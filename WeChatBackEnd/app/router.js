'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  app.ws.use(async (ctx, next) => {
    // 获取参数 ws://localhost:7001/ws?token=123456
    // ctx.query.token
    // 验证用户token
    let user = {};
    let token = ctx.query.token;
    try {
      user = ctx.checktoken(token);
      // 验证用户状态
      let userCheck = await app.model.User.findByPk(user.id);
      if (!userCheck) {
        ctx.websocket.send(JSON.stringify({
          msg: "fail",
          data: '用户不存在'
        }));
        return ctx.websocket.close();
      }
      if (!userCheck.status) {
        ctx.websocket.send(JSON.stringify({
          msg: "fail",
          data: '你已被禁用'
        }));
        return ctx.websocket.close();
      }
      // 用户上线
      app.ws.user = app.ws.user ? app.ws.user : {};
      // 下线其他设备
      if (app.ws.user[user.id]) {
        app.ws.user[user.id].send(JSON.stringify({
          msg: "fail",
          data: '你的账号在其他设备登录'
        }));
        app.ws.user[user.id].close();
      }
      // 记录当前用户id
      ctx.websocket.user_id = user.id;
      app.ws.user[user.id] = ctx.websocket;
      app.ws.user[user.id].send('ok')
      // app.ws.user是用来记录所有上线用户的对象,其中每个ctx.websoket中又包含了user_id
      // 例如
      /*
      app.ws.user:{
        1:ctx.websocket,
        2:ctx.websoket
      }
      */
      await next();
    } catch (err) {
      console.log(err);
      let fail = err.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
      ctx.websocket.send(JSON.stringify({
        msg: "fail",
        data: fail
      }))
      // 关闭连接
      ctx.websocket.close();
    }
  });
  router.get('/', controller.home.index);
  // 用户注册
  router.post('/user/resign', controller.user.reg)
  // 用户登录
  router.post('/user/login', controller.user.login)
  // 用户退出
  router.get('/user/logout', controller.user.logout)
  // 个人
  router.get('/user/qr/:id',app.controller.user.getqr)
  // 搜索用户
  router.post('/search/searchuser', controller.search.searchuser)
  // 申请好友
  router.post('/apply/addFriend', controller.apply.addFriend)
  // 获取好友申请列表
  router.get('/apply/:page', controller.apply.List)
  // 处理好友申请结果
  router.post('/apply/handleapply/:id', controller.apply.handleapply)
  // 处理好友列表
  router.get('/friend/list', controller.friend.List);
  // 查看好友详情
  router.post('/friend/frienddetail/:id', controller.friend.GetFriendDetial);
  // 移入/移出黑名单
  router.post('/friend/setblack/:id', controller.friend.setBlack);
  // 移入/移出星标好友
  router.post('/friend/setstar/:id', controller.friend.setStar);
  // 朋友圈权限
  router.post('/friend/setmomentauth/:id', controller.friend.setMomentAuth);
  // 举报好友
  router.get('/friend/delete/:id',app.controller.friend.deletefriend)
  // 删除好友
  router.post('/report/reportuser', controller.report.reportuser);
  // 设置备注和标签
  router.post('/friend/setremarktag/:id', controller.friend.setRemarkTag)
  // 配置websocket连接
  // app/router.js
  app.ws.route('/ws', app.controller.chat.connect);
  // 发送单/群聊
  router.post('/chat/send', app.controller.chat.send)
  // 撤回单/群聊
  router.post('/chat/recall', app.controller.chat.recall)
  // 创建群聊
  router.post('/group/addgroup', app.controller.group.createGroup)
  // 获取离线消息
  router.post('/chat/getdisconnectmessage', app.controller.chat.getdisconnectMessage)
  // 群聊相关
  router.post('/user/updateuser',app.controller.user.updateuser)
  // 将群成员踢出群聊
  router.post('/group/invite_add_group',app.controller.group.invite_add_group)
  // 邀请群成员加入
  router.post('/group/kickout/:id',app.controller.group.kickout)
  // 文件上传
  router.post('/common/upload', app.controller.common.upload)
  // 群聊列表
  router.get('/group/:page', app.controller.group.List)
  // 群信息
  router.get('/group/groupdetail/:id', app.controller.group.groupdetail)
  // 修改群名称
  router.post('/group/updategroupname', app.controller.group.updategroupname)
  // 修改群公告
  router.post('/group/updategroupremark', app.controller.group.updategroupremark)
  // 修改群昵称
  router.post('/group/updatenickname',app.controller.group.updatenickname)
  // 退出/解散群
  router.post('/group/quit',app.controller.group.quit)
  // 发送新朋友圈
  router.post('/moment/new',app.controller.moment.create)
  // 群二维码
  router.get('/group/qr/:id',app.controller.group.getqr)
  // 朋友圈列表
  router.get('/moment/:page',app.controller.moment.timeLineList)
  // 我的朋友圈列表
  router.get('/moment/my/:page',app.controller.moment.myMomentList)
  // 朋友圈点赞
  router.post('/moment/momentLike',app.controller.moment.momentLike)
  // 朋友圈评论
  router.post('/moment/momentComment',app.controller.moment.momentComment)
};
