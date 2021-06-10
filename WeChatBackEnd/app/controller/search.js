'use strict';

const Controller = require('egg').Controller;
module.exports = app => {
    class SearchController extends app.Controller {
        async searchuser() {
            const { app, ctx } = this;
            let { keyword } = ctx.request.body
            let current_user = ctx.authuser
            // 参数验证
            ctx.validate({
                keyword: { type: 'string', required: true, desc: '关键词' },
            });
            if(keyword===current_user.username)
            {
                ctx.throw(400,'不能搜索自己')
            }
            // 搜索用户是否存在且未被禁用
            let user = await app.model.User.findOne({
                where:{
                    username:keyword
                },
                attributes:{
                    exclude:['password']
                }
            })
            if(!user) return ctx.apiFail(400,'该用户不存在')
            user = JSON.parse(JSON.stringify(user))
            // 返回搜索结果
            ctx.apiSuccess(user)
        }
    }
    return SearchController;
};
