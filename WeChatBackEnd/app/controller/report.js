'use strict';

module.exports = app => {
 class Controller extends app.Controller {
    async reportuser()
    {
        const {ctx,app} = this;
        let current_id = ctx.authuser.id;
        // 参数校验
        ctx.validate({
            reported_id: { type: 'int', required: true, desc: '被举报人' },
            reported_type: { type: 'string', required: true, desc: '举报类型',range:['user','group'] },
            content: { type: 'string', required: true, desc: '举报内容' },
            category: { type: 'string', required: true, desc: '举报分类' },
        });
        let {reported_type,reported_id,content,category} = ctx.request.body;
        // 举报人不能为自己且举报人存在
        if(reported_type == 'user' && reported_id === current_id)
        {
            ctx.throw(400,'不能举报自己')
        }
        if(!await app.model.User.findOne({
            where:{
                id:reported_id,
                status:1
            }
        }))
        {
            ctx.throw(400,'举报对象不存在或已被禁用')
        }
        // 之前是否被举报过
        let report = await app.model.Report.findOne({
            where:{
                user_id:current_id,
                reported_type,
                category,
                reported_id,
                status:'pending'
            }
        })
        if(report)
        {
            ctx.throw(400,'您已举报过该用户,请等待处理')
        }
        // 创建举报
        await app.model.Report.create({
            user_id:current_id,
            reported_type,
            reported_id,
            content,
            category
        })
        ctx.apiSuccess('ok')
    }
 }
 return Controller;
};
