'use strict';

module.exports = app => {
    class Controller extends app.Controller {
        async createGroup() {
            const { ctx, app } = this;
            //  参数校验
            let current_id = ctx.authuser.id;
            ctx.validate({
                ids: { type: 'array', required: true, desc: '好友' },
            });
            let ids = ctx.request.body.ids
            // 好友是否存在
            let friend = await app.model.Friend.findAll({
                where: {
                    user_id: current_id,
                    friend_id: ids
                },
                include: [
                    {
                        model: app.model.User,
                        as: 'friendinfo',
                        attributes: ['username', 'nickname'],
                    }
                ]
            })
            if (!friend.length) return ctx.apiFail('好友不存在')
            // 群名称拼接
            let name = friend.map(v => v.friendinfo.nickname || v.friendinfo.username)
            name.push(ctx.authuser.nickname || ctx.authuser.username)
            // 创建群聊
            let group = await app.model.Group.create({
                avatar: '',
                name: name.join(','),
                user_id: current_id,
                status: 1,
                invite_confirm: 1,
                remark: ''
            })
            // 创建群聊关系
            // 组织格式
            let data = friend.map(v => {
                return {
                    user_id: v.friend_id,
                    nickname: v.friendinfo.nickname || v.friendinfo.username,
                    group_id: group.id
                }
            })
            data = [...data, {
                user_id: current_id,
                nickname: ctx.authuser.nickname || ctx.authuser.username,
                group_id: group.id
            }]
            // 此处发送对象就是ctx.authuser
            let groupuser = await app.model.GroupUser.bulkCreate(data)
            // 消息推送
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: '一起聊天吧！！！',
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            message = JSON.stringify(message)
            groupuser.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            // 返回给发送者
        }
        async List() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let page = parseInt(ctx.params.page) || 1;
            let limit = 10;
            let offset = (page - 1) * limit;
            // 查找我所存在的所有群
            let group = await app.model.Group.findAll({
                where: {
                    status: 1
                },
                limit,
                offset,
                include: [
                    {
                        model: app.model.GroupUser,
                        where: {
                            user_id: current_id
                        }
                    }
                ]
            })
            if (!group) return ctx.apiFail('未找到该用户所在群')
            ctx.apiSuccess(group)
        }
        async groupdetail() {
            const { app, ctx } = this;
            let current_id = ctx.authuser.id
            let { id } = ctx.params;
            let groupuser = await app.model.Group.findOne({
                where: {
                    id,
                    status: 1
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'nickname'],
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
            if (!groupuser) return ctx.apiFail('该群不存在')
            // 当前用户是否存在
            let index = groupuser.group_users.findIndex(v => v.user_id == current_id)
            if (index == -1 ) return ctx.throw(400,'您不在该群中')
            ctx.apiSuccess(groupuser)
        }
        async updategroupname() {
            const { app, ctx } = this;
            ctx.validate({
                id: { type: 'int', required: true, desc: '群组id' },
                name: { type: 'string', required: true, desc: '群聊名称' }
            });
            let { name, id } = ctx.request.body
            let current_id = ctx.authuser.id;
            let group = await app.model.Group.findOne({
                where: {
                    id,
                    status: 1,
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'group_id']
                    }
                ]
            })
            if (!group) return ctx.apiFail('该群不存在')
            // 当前用户是否存在
            let index = group.group_users.findIndex(v => {
                return v.user_id === current_id
            })
            if (index == -1) return ctx.apiFail('您不在该群')
            if (group.user_id !== current_id) return ctx.apiFail('您不是该群群主');
            group.name = name;
            await group.save()
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: `管理员将群名称修改为:${name}`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            message = JSON.stringify(message)
            group.group_users.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('ok')
        }
        // 推送群公告
        async updategroupremark() {
            const { app, ctx } = this;
            ctx.validate({
                id: { type: 'int', required: true, desc: '群组id' },
                remark: { type: 'string', required: true, desc: '群公告' }
            });
            let { remark, id } = ctx.request.body
            let current_id = ctx.authuser.id;
            let group = await app.model.Group.findOne({
                where: {
                    id,
                    status: 1,
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'group_id']
                    }
                ]
            })
            if (!group) return ctx.apiFail('该群不存在')
            // 当前用户是否存在
            let index = group.group_users.findIndex(v => {
                return v.user_id === current_id
            })
            if (index == -1) return ctx.apiFail('您不在该群')
            if (group.user_id !== current_id) return ctx.apiFail('您不是该群群主');
            group.remark = remark;
            await group.save()
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: `管理员发布公告内容为:${remark}`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            message = JSON.stringify(message)
            group.group_users.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('ok')
        }
        // 
        // 退出或解算群聊
        async quit() {
            const { app, ctx } = this;
            let current_id = ctx.authuser.id;
            // 参数验证
            ctx.validate({
                id: { type: 'int', required: true, desc: '群组id' },
            });
            let { id } = ctx.request.body
            // 查找该群
            let group = await app.model.Group.findOne({
                where: {
                    status: 1,
                    id
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'nickname'],
                    }
                ]
            })
            // 我是否在该群
            if (!group) {
                return ctx.throw(400, '该群聊不存在')
            }
            let index = group.group_users.findIndex(v => {
                return v.user_id === current_id
            })
            if (index == -1) {
                return ctx.apiFail('您不在该群')
            }
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: ``,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            // 判断是退出还是解散
            if (group.user_id == current_id) {
                // 解散
                await app.model.Group.destroy({
                    where: {
                        id
                    }
                })
            } else {
                await app.model.GroupUser.destroy({
                    where: {
                        group_id: id,
                        user_id: current_id
                    }
                })
            }
            message.data = `${group.group_users[index].nickname}${group.user_id == current_id ? '解散' : '退出'}了本群`
            message = JSON.stringify(message)
            group.group_users.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('修改成功')
            // 修改成功返回
        }
        async updatenickname() {
            const { app, ctx } = this;
            let current_id = ctx.authuser.id;
            // 参数验证
            ctx.validate({
                id: { type: 'int', required: true, desc: '群组id' },
                nickname: { type: 'string', required: true, desc: '昵称不能为空' },
                oldnickname: { type: 'string', required: true, desc: '旧昵称不能为空' },
            });
            let { id, nickname, oldnickname } = ctx.request.body
            if (nickname == oldnickname) return ctx.apiFail('昵称不能重复')
            // 查找该群
            let group = await app.model.Group.findOne({
                where: {
                    status: 1,
                    id
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'nickname'],
                    }
                ]
            })
            // 我是否在该群
            let index = group.group_users.findIndex(v => {
                return v.user_id === current_id
            })
            if (index == -1) {
                return ctx.apiFail('您不在该群')
            }
            let mygroup = await app.model.GroupUser.findOne({
                where: {
                    group_id: id,
                    user_id: current_id
                }
            })
            if (!mygroup) return ctx.apiFail('您不在该群')
            mygroup.nickname = nickname;
            await mygroup.save();
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: `${oldnickname}将群昵称修改为${nickname}`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            message = JSON.stringify(message)
            group.group_users.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('修改成功')
            // 修改成功返回
        }
        async getqr() {
            const { ctx } = this;
            let { id } = ctx.params
            ctx.getqrcode('http://xzq-chat-bucket.oss-cn-beijing.aliyuncs.com/egg-oss-demo/8m27fsn55n40000.mp3')
        }
        async kickout() {
            const { app, ctx } = this;
            // 参数校验
            ctx.validate({
                group_id: { type: 'int', required: true, desc: '踢出成员id' },
                id: { type: 'int', required: true, desc: '踢出成员id' },
            });
            let { id } = ctx.params;
            let { group_id } = ctx.request.body
            let current_id = ctx.authuser.id;
            // 我是否在该群,我是否是该群管理员
            if (id == current_id) return ctx.throw(400, '不能踢出自己')
            let group = await app.model.Group.findOne({
                where: {
                    user_id: current_id,
                    status: 1,
                    id: group_id
                },
                include: [{
                    model: app.model.GroupUser,
                    attributes: ['user_id', 'nickname']
                }]
            })
            if (!group) return ctx.throw(400, '您不是该群管理员')
            // 对方是否是该群成员
            let GroupUsers = group.group_users.map(v => {
                return {
                    user_id: v.user_id,
                    nickname: v.nickname
                }
            });
            let index = GroupUsers.findIndex(v => v.user_id == id)
            let groupownerindex = GroupUsers.findIndex(v => v.user_id == current_id)
            let kickobj = GroupUsers[index]
            let groupowner = GroupUsers[groupownerindex]
            if (index == -1) return ctx.throw(400, '踢出对象不是群成员')
            // 踢出群
            await app.model.GroupUser.destroy({
                where: {
                    user_id: id
                }
            })
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: `${groupowner.nickname}将成员${kickobj.nickname}踢出群聊`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            GroupUsers.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('ok')
            // 消息推送
        }
        // 邀请好友加入群聊
        async invite_add_group() {
            const { app, ctx } = this;
            let current_id = ctx.authuser.id;
            // 参数校验
            ctx.validate({
                group_id: { type: 'int', required: true, desc: '群id' },
                id: { type: 'int', required: true, desc: '邀请加入成员id' },
            })
            let { id, group_id } = ctx.request.body;
            // 邀请人校验，是否为群管理员
            let group = await app.model.Group.findOne({
                where: {
                    id:group_id,
                    status: 1
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'nickname']
                    }
                ]
            })
            let user = await app.model.User.findOne({
                where: {
                    id,
                    status: 1
                }
            })
            if (!group) return ctx.throw(400, '该群聊不存在');
            if (group.user_id !== current_id) return ctx.throw(400, '您不是该群管理员');
            // 被邀请人是否已经在群中
            let index = group.group_users.findIndex(v => v.user_id == id);
            if (index !== -1) return ctx.throw(400, '邀请对象已在群聊中')
            // 加入群聊
            let guser = await app.model.GroupUser.create({
                user_id: id,
                group_id,
                nickname: user.nickname || user.username
            })
            if (!guser) return ctx.throw(400, '邀请失败');
            let invite_index = group.group_users.findIndex(v => v.user_id == current_id)
            let invite_user = group.group_users[invite_index]
            // 通知群成员消息
            let newgroup = await app.model.Group.findOne({
                where: {
                    id:group_id,
                    status: 1
                },
                include: [
                    {
                        model: app.model.GroupUser,
                        attributes: ['user_id', 'nickname']
                    }
                ]
            })
            let message = {
                id: (new Date().getTime()),
                from_avatar: '',
                from_name: '系统提示',
                from_id: '',
                to_id: group.id,
                to_name: group.name,
                to_avatar: '',
                chat_type: 'group',
                type: 'system',
                data: `${invite_user.nickname}邀请${guser.nickname || guser.username}加入群聊`,
                options: {},//消息参数
                created_time: (new Date().getTime()),
                isremove: 0,
            }
            newgroup.group_users.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id)
            })
            ctx.apiSuccess('ok')
        }
    }
    return Controller;
};
