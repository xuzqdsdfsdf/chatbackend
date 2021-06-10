'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    // ctx.body = 'hi, egg';
    let list=[{
      id:1,
      data:1
    }]
    ctx.apiSuccess(list)
  }
}

module.exports = HomeController;
