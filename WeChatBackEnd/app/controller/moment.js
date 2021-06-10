'use strict';

module.exports = app => {
    class Controller extends app.Controller {
        async create() {
            const { ctx, app } = this;
            // 参数校验
            ctx.validate({
                content: { type: 'string', required: false, desc: '发布内容' },
                image: { type: 'string', required: false, defValue: '', desc: '图片列表' },
                video: { type: 'string', required: false, defValue: '', desc: '视频' },
                location: { type: 'string', required: false, defValue: '保密', desc: '位置' },
                remind: { type: 'string', required: false, defValue: '', desc: '提醒谁看' },
                see: { type: 'string', required: false, defValue: 'all', desc: '谁可以看' },
                type: { type: 'string', required: true, defValue: 'text', desc: '朋友圈类型', range: ['content', 'image', 'video'] },
            });
            let current_id = ctx.authuser.id;
            let { content, image, video, location, remind, see, type } = ctx.request.body;
            if (!ctx.request.body[type]) {
                return ctx.throw(400, `${ctx.request.body[type]}不能为空`)
            }
            // 创建新的瞬间
            let moment = await app.model.Moment.create({ content, image, video, location, remind, see, user_id: current_id });
            if (!moment) return ctx.apiFail('创建失败')
            await this.sendTimeline(moment);
            ctx.apiSuccess('ok')
            // 推送给好友
            // 返回成功标识
        }
        async sendTimeline(moment) {
            const { ctx, app } = this;
            // 获取好友列表
            let current_id = ctx.authuser.id;
            let friends = await app.model.Friend.findAll({
                where: {
                    user_id: current_id,
                    isblack: 0
                },
                attributes: ['friend_id']
            })
            // all 所有人可以看
            // only:1,2,3 只有数组中的好友可以看 ['only','1,2,3']
            // except:1,2,3 除了数组中的好友都可以看['except','1,2,3']
            // none 仅自己可见
            let o = {
                only: [],
                except: []
            }
            let sees = moment.see.split(':')
            let Otype = sees[0];
            // 再切割数组中的每一项
            if ((sees[0] == 'only' || sees[0] == 'except') && sees[1]) {
                o[Otype] = (sees[1].split(',')).map(v => parseInt(v))
            }
            // see[1]是每一项所包含的数组内容
            let adddata = friends.filter(item => {
                return (Otype == 'all') || (Otype == 'only' && sees[1].includes(item.friend_id) || (Otype == 'except' && !sees[1].includes(item.friend_id)))
            });
            // 需要添加到自己的时间树中
            adddata = [...adddata, { friend_id: current_id }]
            adddata = adddata.map(v => {
                return {
                    user_id: v.friend_id,
                    moment_id: moment.id,
                    own: v.friend_id == current_id ? 1 : 0
                }
            })
            // 消息推送
            await app.model.MomentTimeline.bulkCreate(adddata)
            let message = {
                avatar: ctx.authuser.avatar,
                user_id: current_id,
                type: 'new'
            }
            adddata.forEach(v => {
                ctx.sendAndSaveMessage(message, v.user_id, 'newmoment')
            })
        }
        // 检测该好友检测是否有评论/点赞资格
        async testauth(moment, current_id) {
            let o = {
                only: [],
                except: []
            }
            let obj = moment.see.split(':');
            let otype = obj[0]
            if ((otype == 'only' || otype == 'except' && obj[1]) && current_id != moment.user_id) {
                o[otype] = obj[1].split(',').map(v => parseInt(v));
                // 是否包含其中
                if ((otype == 'only' && !obj[1].includes(current_id)) || (otype == 'except' && obj[1].includes(current_id))) {
                    return ctx.throw(400, '您没有权限给该朋友圈点赞')
                }
            }
        }
        // 朋友圈点赞
        async momentLike() {
            const { ctx, app } = this;
            // 参数验证
            let current_id = ctx.authuser.id
            ctx.validate({
                id: { type: 'int', required: true, desc: '点赞的朋友圈id' },
            })
            let { id } = ctx.request.body;
            let moment = await app.model.Moment.findOne({
                where: {
                    id
                }
            })
            if (!moment) return ctx.throw(400, '该朋友圈不存在')
            // 资格校验
            await this.testauth(moment, current_id);
            // 到此已经为全部通过
            let like = await app.model.MomentLike.findOne({
                where: {
                    moment_id: id,
                    user_id: current_id
                }
            })
            // 不存在则创建一个
            if (!like) {
                await app.model.MomentLike.create({
                    user_id: current_id,
                    moment_id: id
                })
                ctx.apiSuccess('confirmup')
                //  通过用户朋友圈已被点赞
            } else {
                await like.destroy();
                ctx.apiSuccess('cancelup')
            }
        }
        // 朋友圈评论
        async momentComment() {
            const { ctx, app } = this;
            // 参数验证
            let current_id = ctx.authuser.id
            ctx.validate({
                id: { type: 'int', required: true, desc: '评论的朋友圈id' },
                content: { type: 'string', required: true, desc: '评论内容' },
                reply_id: { type: 'int', required: false, defValue: 0, desc: '回复评论id' },
            })
            let { id, content, reply_id } = ctx.request.body;
            let moment = await app.model.Moment.findOne({
                where: {
                    id
                }
            })
            if (!moment) return ctx.throw(400, '该朋友圈不存在')
            // 资格校验
            await this.testauth(moment, current_id);
            // 到此已经为全部通过
            let like = await app.model.MomentComment.findOne({
                where: {
                    moment_id: id,
                    user_id: current_id
                }
            })
            // 不存在则创建一个
                await app.model.MomentComment.create({
                    user_id: current_id,
                    moment_id: id,
                    reply_id,
                    content
                })
                ctx.apiSuccess('评论成功')
                //  通过用户朋友圈已被点赞
        }
        // 所有人的朋友圈列表
        async timeLineList() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let limit = 10;
            let page = ctx.params.page ? parseInt(ctx.params.page) : 1
            let offset = (page - 1) * limit;
            let datas = await app.model.MomentTimeline.findAll({
                where: {
                    user_id: current_id
                },
                offset,
                limit,
                order: [['id', 'DESC']],
                include: [
                    {
                        model: app.model.Moment,
                        attributes: ['id', 'content', 'image', 'video', 'location', 'user_id'],
                        include: [
                            {
                                model: app.model.User,
                                attributes: ['avatar', 'id', 'username', 'nickname']
                            },
                            {
                                model: app.model.MomentLike,
                                attributes: ['user_id'],
                                include: [{
                                    model: app.model.User,
                                    attributes: ['id', 'username', 'nickname']
                                }]
                            },
                            {
                                model: app.model.MomentComment,
                                include: [
                                    {
                                        model: app.model.User,
                                        as: 'momentCommentUser',
                                        attributes: ['id', 'username', 'nickname']
                                    },
                                    {
                                        model: app.model.User,
                                        as: 'momentCommentReply',
                                        attributes: ['id', 'username', 'nickname']
                                    }
                                ]
                            }
                        ]
                    },

                ]
            })
            // 查找所有好友
            let friends = await app.model.Friend.findAll({
                where: {
                    user_id: current_id
                }
            })
            // console.log(JSON.parse(JSON.stringify(datas)));
            friends = friends.map(v => v.friend_id)
            // 发布瞬间
            datas = datas.map(item => {
                let comments = [];
                let likes = [];
                // 重新组合comments
                item.moment.moment_comments.forEach(v => {
                    if (friends.includes(v.momentCommentUser.id) || v.momentCommentUser.id == current_id) {
                        comments.push({
                            id:v.id,
                            content: v.content,
                            user: {
                                id: v.momentCommentUser.id,
                                name: v.momentCommentUser.nickname || v.momentCommentUser.username,
                            },
                            reply: v.momentCommentReply ? {
                                id: v.momentCommentReply.id,
                                name: v.momentCommentReply.nickname || v.momentCommentReply.username
                            } : null
                        })
                    }
                })
                // 重新组合likes
                item.moment.moment_likes.forEach(i => {
                    if (friends.includes(i.user.id) || i.user.id == current_id) {
                        likes.push({
                            id: i.user.id,
                            name: i.user.nickname || i.user.username
                        })
                    }
                })
                return {
                    id: item.id, //时间轴id
                    user_id: item.moment.user_id,
                    user_name: item.moment.user.nickname || item.moment.user.username, //发布用户的昵称
                    avatar: item.moment.user.avatar,
                    moment_id: item.moment.id,
                    content: item.moment.content,
                    image: item.moment.image ? item.moment.image.split(',').map(v=>{
                        return {
                            src:v
                        }
                    }) : [],
                    video: item.moment.video ? JSON.parse(item.moment.video) : null,
                    location: item.moment.location,
                    own: item.own,
                    likes,
                    comments,
                    created_at: item.created_at
                }
            })
            ctx.apiSuccess(datas)
        }
        // 某人朋友圈列表
        async myMomentList() {
            const { ctx, app } = this;
            let current_id = ctx.authuser.id;
            let limit = 10;
            let page = ctx.params.page ? parseInt(ctx.params.page) : 1
            let offset = (page - 1) * limit;
            let user_id = ctx.query.id?parseInt(ctx.query.id):0
            // 不需要再去查timeline表
            let data = await app.model.Moment.findAll({
                where: {
                    user_id: user_id || current_id
                },
                limit,
                offset,
                order: [['id', 'DESC']],
                include: [
                    {
                        model: app.model.User,
                        attributes: ['avatar', 'id', 'username', 'nickname']
                    },
                    {
                        model: app.model.MomentLike,
                        attributes: ['user_id'],
                        include: [{
                            model: app.model.User,
                            attributes: ['id', 'username', 'nickname']
                        }]
                    },
                    {
                        model: app.model.MomentComment,
                        include: [
                            {
                                model: app.model.User,
                                as: 'momentCommentUser',
                                attributes: ['id', 'username', 'nickname']
                            },
                            {
                                model: app.model.User,
                                as: 'momentCommentReply',
                                attributes: ['id', 'username', 'nickname']
                            }
                        ]
                    }
                ]
            })
            // 加载评论和点赞
            data = data.map(item => {
                let comments = item.moment_comments.map(v => {
                    return {
                        content: v.content,
                        user: {
                            id: v.momentCommentUser.id,
                            name: v.momentCommentUser.nickname || v.momentCommentUser.username,
                        },
                        reply: v.momentCommentReply ? {
                            id: v.momentCommentReply.id,
                            name: v.momentCommentReply.nickname || v.momentCommentReply.username
                        } : null
                    }
                })
                let likes = item.moment_likes.map(v => {
                    return {
                        id: v.user.id,
                        name: v.user.nickname || v.user.username
                    }
                })
                return {
                    user_id: item.user_id, //发布人id
                    user_name: item.user.nickname || item.user.username, //发布用户的昵称
                    avatar: item.user.avatar,
                    moment_id: item.id,
                    content: item.content,
                    image: item.image ? item.image.split(',').map(v=>{
                        return {
                            src:v
                        }
                    }) : [],
                    video: item.video ? JSON.parse(item.video) : null,
                    location: item.location,
                    own: item.own,
                    likes,
                    comments,
                    created_at: item.created_at
                }
            })
            return ctx.apiSuccess(data)
        }
    }
    return Controller;
};
