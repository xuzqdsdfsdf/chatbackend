module.exports = (option, app) => {
    return async (ctx, next) => {
        let  token  = ctx.header.token || ctx.query.token
        let user = {}
        if (!token) {
            ctx.throw(400, '您没有访问接口的权限')
        }
        try {
            // 根据token换取用户信息
             user = ctx.checktoken(token)
        } catch (error) {
            let fail = error.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
            ctx.throw(400, fail);
        }
        // 判断用户是否存在
        let t =await ctx.service.cache.get(`user_${user.id}`)
        if(!t && t!==token)
        {
            return ctx.apiFail('Token令牌不合法')
        }
        // 判断用户是否被禁用
        let getuser = await app.model.User.findOne({
            where:{
                username:user.username,
                status:user.status
            }
        })
        if(!getuser)
        {
           return ctx.throw(400,'该用户不存在或已被禁用')
        }
        // 把user挂载到全局ctx伤
        ctx.authuser = getuser;
        return next()
    }
}