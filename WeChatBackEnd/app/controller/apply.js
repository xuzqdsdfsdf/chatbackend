'use strict';

module.exports = app => {
    class Controller extends app.Controller {
        //  添加好友
        async addFriend() {
            const { ctx, app } = this;
            //   参数验证
            ctx.validate({
                friend_id: { type: 'string', required: true, desc: '好友id' },
                nickname: { type: 'string', required: true, desc: '好友昵称' },
                lookme: { type: 'int', required: true, desc: '看我', range: [0, 1] },
                lookhim: { type: 'int', required: true, desc: '看他', range: [0, 1] },
            });
            let current_id = ctx.authuser.id;
            let { friend_id, nickname, lookme, lookhim } = ctx.request.body;
            // 添加好友是否为自己
            if (current_id === friend_id) {
                return ctx.throw(400, '不能添加自己为好友')
            }
            // 好友是否存在
            let user = await app.model.User.findOne({
                where: {
                    id: friend_id,
                    status: 1
                }
            })
            if (!user) {
                ctx.apiFail('您添加的好友不存在或已被禁用')
            }
            // 申请是否存在
            let isexist = await app.model.Apply.findOne({
                where: {
                    user_id: current_id,
                    friend_id,
                    status: ['pending', 'agree']
                }
            })
            // 判断是否是被添加的人操作

            if (isexist) {
                return ctx.apiFail('您已经申请过了')
            }
            // 返回申请创建结果
            let apply = await app.model.Apply.create({
                user_id: current_id,
                friend_id,
                nickname,
                lookme,
                lookhim
            })
            if (!apply) {
                return ctx.apiFail('申请失败')
            }
            let message = {
                id: (new Date().getTime()),
                created_time: (new Date().getTime()),
            }
            ctx.sendAndSaveMessage(message, friend_id, 'newfriend')
            ctx.apiSuccess(apply)
        }
        // 获取申请列表
        async List() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let page = ctx.params.page ? parseInt(ctx.params.page) : 1;
            let limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
            let offset = (page - 1) * limit;
            let list = await app.model.Apply.findAll({
                offset,
                limit,
                where: {
                    friend_id: current_id,
                },
                order: [['id', 'DESC']],
                include: [{
                    model: app.model.User,
                    attributes: ['id', 'nickname', 'avatar', 'username']
                }]
            })
            // 计算未处理的申请
            let count = await app.model.Apply.count({
                where: {
                    status: 'pending',
                    friend_id: current_id
                }
            })
            ctx.apiSuccess({ list, count, current_id })
        }
        // 处理好友申请
        async handleapply() {
            // 参数验证
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let { id } = ctx.params;
            ctx.validate({
                nickname: { type: 'string', required: true, desc: '好友昵称' },
                lookme: { type: 'int', required: true, desc: '看我', range: [0, 1] },
                lookhim: { type: 'int', required: true, desc: '看他', range: [0, 1] },
                status: { type: 'string', required: true, desc: '看他', range: ['agree', 'refuse', 'ignore'] },
            });
            let { nickname, lookme, lookhim, status } = ctx.request.body;
            // 查看申请是否存在
            let apply = await app.model.Apply.findOne({
                where: {
                    id,
                    status: 'pending'
                }
            })
            if (!apply) {
                ctx.throw(400, '添加失败')
            }
            if (current_id !== apply.friend_id) {
                return ctx.throw(400, '您不能处理该操作')
            }
            let { friend_id } = apply
            let transaction;
            // 事务处理
            try {
                // 开启事务
                transaction = await app.model.transaction();
                // let result = await data.update({
                //     status
                // }, { transaction });
                // 修改申请状态(如果status为agree才进行后面操作)
                let result = await apply.update({
                    status
                }, { transaction })
                if (status == 'agree') {
                    // 将对方加入我的好友列表(对方不存在我的好友列表中)
                    //user_id是申请人的id，friend_id是被申请人的id
                    if (!await app.model.Friend.findOne({
                        where: {
                            friend_id: apply.user_id,
                            user_id: current_id
                        }
                    })) {
                        await app.model.Friend.create({
                            friend_id: apply.user_id,
                            user_id: current_id,
                            nickname,
                            lookhim,
                            lookme
                        }, { transaction })
                    }
                    // 将我加入对方的好友列表(查看我是否存在对方的好友列表中)
                    if (!await app.model.Friend.findOne({
                        where: {
                            friend_id: current_id,
                            user_id: apply.user_id
                        }
                    })) {
                        await app.model.Friend.create({
                            friend_id: current_id,
                            user_id: apply.user_id,
                            nickname: apply.nickname,
                            lookhim: apply.lookhim,
                            lookme: apply.lookme
                        }, { transaction })
                    }
                }
                // 提交事务
                await transaction.commit();
                // 处理成功结果

                 ctx.apiSuccess('操作成功');
            } catch (e) {
                // 事务回滚
                await transaction.rollback();
                return ctx.apiFail('操作失败');
            }
            let me = await app.model.Friend.findOne({
                where: {
                    friend_id: apply.user_id,
                    user_id: current_id,
                    nickname,
                    lookhim,
                    lookme
                }
            })
            let him = await app.model.Friend.findOne({
                where: {
                    friend_id: current_id,
                    user_id: apply.user_id,
                    nickname: apply.nickname,
                    lookhim: apply.lookhim,
                    lookme: apply.lookme
                }
            })
            let mymessage = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: me.nickname,
                from_id: him.user_id,
                to_id: me.user_id,
                to_name: him.nickname,
                to_avatar: '',
                chat_type: 'user',
                type: 'system',
                data: `你们已经是好友了快开始聊天把`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            let applyusermessage = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: him.nickname,
                from_id: me.user_id,
                to_id: him.user_id,
                to_name: me.nickname,
                to_avatar: '',
                chat_type: 'user',
                type: 'system',
                data: `你们已经是好友了快开始聊天把`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            ctx.sendAndSaveMessage(applyusermessage,him.user_id,'ok')
            ctx.sendAndSaveMessage(mymessage,me.user_id,'ok')
            return ctx.apiSuccess('ok')
        }
    }

    return Controller;
};
