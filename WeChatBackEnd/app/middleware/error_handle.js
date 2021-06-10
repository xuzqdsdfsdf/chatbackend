module.exports = (option, app) => {
    return async function errorHandle(ctx, next) {
        try {
            await next()
            if (ctx.status === 404 && !ctx.body) {
                ctx.body = {
                    msg: 'fail',
                    data: '404 错误'
                }
            }
        } catch (err) {
            app.emit('error', err, ctx);
            
            const status = err.status || 500;
            // 服务器异常
            let error = (status === 500 && app.config.env === 'prod')
            ? 'Internal Server Error'
            : err.message;
            ctx.body = {
                msg: "fail",
                data: error
            };
            // 参数校验异常
            if(err.status === 422 && err.message === 'Validation Failed')
            {
                if(err.errors && Array.isArray(err.errors))
                {
                    error=err.errors[0].err[0]
                    ctx.body={
                        data:error,
                        msg:'fail'
                    }
                }
            }
            ctx.status = status;
        }
    }
}