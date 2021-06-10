'use strict';
const SortWord = require('sort-word')
module.exports = app => {
    class Controller extends app.Controller {
        //  获取好友列表
        async List() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            // 获取好友列表
            ctx.apiSuccess('ok')
            let list = await app.model.Friend.findAll({
                where: {
                    user_id: current_id
                },
                include: [
                    {
                        model: app.model.User,
                        as: 'friendinfo',
                        attributes: ['username', 'id', 'nickname', 'avatar']
                    },
                ]
            })
            list = list.map(v => {
                let name = v.friendinfo.nickname ? v.friendinfo.nickname : v.friendinfo.username;
                if (v.nickname) name = v.nickname
                return {
                    name,
                    user_id: v.friendinfo.id,
                    friend_id: v.id,
                    username: v.friendinfo.username,
                    avatar: v.friendinfo.avatar
                }
            })
            if (list.length > 0) {
                list = new SortWord(list, 'name')
            }
            ctx.apiSuccess(list)
        }
        // 获取好友详情
        async GetFriendDetial() {
            const { ctx, app } = this;
            let friend_id = ctx.params.id;
            let current_id = ctx.authuser.id;
            // 用户查询
            if (friend_id == current_id) {
                ctx.throw(400, '不能查询自己')
            }
            let res = await app.model.User.findOne({
                where: {
                    id: friend_id,
                    status: 1
                },
                attributes: {
                    exclude: ['password']
                }
            })
            if (!res) {
                return ctx.throw(400, '用户不存在')
            }
            res = {
                username: res.username,
                nickname: res.nickname ? res.nickname : res.username,
                email: res.email,
                avatar: res.avatar,
                phone: res.phone,
                sex: res.sex,
                sign: res.sign,
                area: res.area,
                friend: false
            }
            // 查找好友是否存在
            let friend = await app.model.Friend.findOne({
                where: {
                    user_id: current_id,
                    friend_id
                },
                include: [
                    {
                        model: app.model.Tag,
                    },
                ]
            })
            if (friend) {
                if (friend.nickname) {
                    res.nickname = friend.nickname
                }
                res.friend = true,
                    res.isblack = friend.isblack,
                    res.lookme = friend.lookme,
                    res.lookhim = friend.lookhim,
                    res.star = friend.star,
                    res.tags = friend.tags.map(v => v.name)
            }
            ctx.apiSuccess(res)
        }
        async setBlack() {
            // 参数校验
            const { ctx, app } = this;
            let friend_id = ctx.params.id
            ctx.validate({
                isblack: { type: 'int', required: true, desc: '移入/移出黑名单' },
            });
            let current_id = ctx.authuser.id;
            let { isblack } = ctx.request.body
            let friend = await app.model.Friend.findOne({
                where: {
                    user_id: current_id,
                    friend_id
                }
            })
            if (!friend) {
                ctx.throw(400, '该用户不存在')
            }
            friend.isblack = isblack;
            await friend.save();
            ctx.apiSuccess('ok')
        }
        // 设置星标好友
        async setStar() {
            // 参数校验
            const { ctx, app } = this;
            let friend_id = ctx.params.id
            ctx.validate({
                star: { type: 'int', required: true, desc: '移入/移出星标好友' },
            });
            let current_id = ctx.authuser.id;
            let { star } = ctx.request.body
            // 查找好友用户是否存在
            let friend = await app.model.Friend.findOne({
                where: {
                    user_id: current_id,
                    friend_id,
                    isblack: 0
                }
            })
            if (!friend) {
                ctx.throw(400, '该用户不存在或已被拉黑')
            }
            friend.star = star;
            await friend.save();
            ctx.apiSuccess('ok')
        }
        // 设置朋友圈权限
        async setMomentAuth() {
            // 参数校验
            const { ctx, app } = this;
            let friend_id = ctx.params.id
            ctx.validate({
                lookme: { type: 'int', required: true, desc: '是否可以看我朋友圈' },
                lookhim: { type: 'int', required: true, desc: '是否可以看ta朋友圈' },
            });
            let current_id = ctx.authuser.id;
            let { lookhim, lookme } = ctx.request.body
            // 查找好友用户是否存在
            let friend = await app.model.Friend.findOne({
                where: {
                    user_id: current_id,
                    friend_id,
                    isblack: 0
                }
            })
            if (!friend) {
                ctx.throw(400, '该用户不存在或已被拉黑')
            }
            friend.lookhim = lookhim;
            friend.lookme = lookme;
            await friend.save();
            ctx.apiSuccess('ok')
        }
        // 设置备注和标签
        async setRemarkTag() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let friend_id = ctx.params.id;
            // 参数校验
            ctx.validate({
                nickname: { type: 'string', required: true, desc: '好友昵称' },
                tags: { type: 'string', required: true, desc: '备注' },
            });
            let { nickname, tags } = ctx.request.body
            let friend = await app.model.Friend.findOne({
                where: {
                    user_id: current_id,
                    friend_id
                },
                include: [{
                    model: app.model.Tag
                }]
            })
            if (!friend) {
                ctx.throw(400, '该好友不存在')
            }
            tags = tags.split(',');
            // 修改备注
            friend.nickname = nickname;
            console.log(tags);
            await friend.save();
            if (!tags.length) return ctx.apiSuccess('修改成功')
            // 该用户的所有标签
            let alltags = await app.model.Tag.findAll({
                where: {
                    user_id: current_id
                }
            })
            let alltagNames = alltags.map(v => v.name)
            // 需要新添加的标签
            let newaddtags = tags.filter(v => !alltagNames.includes(v));
            // 新标签
            newaddtags = newaddtags.map(v => {
                return {
                    name: v,
                    user_id: current_id
                }
            })
            let restag = await app.model.Tag.bulkCreate(newaddtags)
            // 找到新标签的所有id
            newaddtags = await app.model.Tag.findAll({
                where: {
                    user_id: current_id,
                    name: tags
                }
            })
            let oldtagsIds = friend.tags.map(v => v.id);
            let newtagsIds = newaddtags.map(v => v.id);
            let addids = newtagsIds.filter(v => !oldtagsIds.includes(v));
            let delids = oldtagsIds.filter(v => !newtagsIds.includes(v));
            let addfriendtags = addids.map(v => {
                return {
                    friend_id: friend.id,
                    tag_id: v
                }
            })
            await app.model.FriendTag.bulkCreate(addfriendtags)
            await app.model.FriendTag.destroy({
                where: {
                    tag_id: delids,
                    friend_id: friend.id
                }
            })
            ctx.apiSuccess({ addids, delids })
        }
        async deletefriend() {
            const { ctx, app } = this;
            let friend_id = ctx.params.id || 0;
            let current_id  = ctx.authuser.id;
            // 好友是否存在
            let transaction;
            try {
                transaction = await app.model.transaction();
                await app.model.Friend.destroy({
                    where:{
                        user_id:current_id,
                        friend_id:friend_id
                    }
                },{transaction})
                await app.model.Friend.destroy({
                    where:{
                        user_id:friend_id,
                        friend_id:current_id
                    }
                },{transaction})
                await transaction.commit();
                return ctx.apiSuccess('ok')
            } catch (error) {
                
            }
            // 存在 存储彼此好友
        }
    }
    return Controller;
};
