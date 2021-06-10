'use strict';

const Controller = require('egg').Controller;
const crypto = require('crypto');
class UserController extends Controller {
  async reg() {
    const { ctx, app } = this;
    // 参数验证
    let { username, password, repassword } = ctx.request.body
    ctx.validate({
      username: {
        type: 'string', required: true, desc: '用户名', range: {
          min: 10,
          max: 20
        }
      },
      password: { type: 'string', required: true, desc: '密码' },
      repassword: { type: 'string', required: true, desc: '重复密码' }
    }, {
      equals: [['password', 'repassword']]
    });
    let user = await app.model.User.findOne({
      where: {
        username
      }
    })
    if (user) ctx.throw(400, '该用户已存在')
    // 创建用户
    let newuser = await app.model.User.create({
      username,
      password
    })
    ctx.apiSuccess(newuser)
  }
  // 登录
  async login() {
    const { ctx, app } = this;
    let { username, password, repassword } = ctx.request.body
    // 参数验证
    ctx.validate({
      username: { type: 'string', required: true, desc: '用户名' },
      password: { type: 'string', required: true, desc: '密码' },
    });
    // 用户是否存在
    let user = await app.model.User.findOne({
      where: {
        username,
        status: 1
      }
    })
    // 用户是否被启用
    if (!user) return ctx.apiFail('用户不存在或被禁用', 'fail', 400)
    // 密码校验
    let isright = await this.checkpassword(password, user.password)
    if (!isright) return ctx.apiFail('密码错误')
    // 生成token
    let nuser = JSON.parse(JSON.stringify(user))
    let token = ctx.createtoken(nuser)
    nuser.token = token;
    delete nuser.password
    // 加入缓存中
    if (!await this.service.cache.set(`user_${nuser.id}`, token)) return ctx.apiFail(400, '登录失败')
    ctx.apiSuccess(nuser)
    // 返回登录结果
  }
  async createpassword(password) {
    const hmac = crypto.createHash("sha256", this.app.config.crypto.secret);
    hmac.update(password);
    return hmac.digest("hex");
  }
  async checkpassword(password, hash_password) {
    password = await this.createpassword(password)
    if (password !== hash_password) return this.ctx.throw(400, '密码错误')
    return true
  }
  // 退出登录
  async logout() {
    const { ctx, app, service } = this;
    let { authuser } = ctx;
    // 当前用户id
    let currentid = ctx.authuser.id;
    // 移出redius
    if (!await service.cache.remove(`user_${currentid}`)) {
      ctx.apiFail(400, '退出用户失败')
    }
    // 从redius中删除token
    ctx.apiSuccess('退出成功')
  }
  // 生成个人名片
  async getqr() {
    const { ctx } = this;
    let { id } = ctx.params
    ctx.getqrcode(JSON.stringify({
      id
    }))
  }
  async updateuser() {
    const { ctx, app } = this;
    ctx.validate({
      nickname: {
        type: 'string', required: false,defValue:'', desc: '昵称'
      },
      avatar: {
        type: 'string', required: false,defValue:'/static/images/demo/demo5.jpg', desc: '头像'
      },
    })
    let { nickname, avatar } = ctx.request.body;
    ctx.authuser.nickname = nickname;
    ctx.authuser.avatar = avatar;
    await ctx.authuser.save();
    ctx.apiSuccess('ok')
  }
  
}

module.exports = UserController;
