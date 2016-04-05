'use strict';
var domain = require('domain');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var wechat = require('./routes/wechatBot');
var cloud = require('./cloud');

var app = express();
// 服务端代码，基于 Node.js、Express
var AV = require('leanengine');
// 服务端需要使用 connect-busboy（通过 npm install 安装）
var busboy = require('connect-busboy');
// 使用这个中间件
app.use(busboy());
// 加载 cookieSession 以支持 AV.User 的会话状态
app.use(AV.Cloud.CookieSession({
	secret: 'my secret',
	maxAge: 3600000,
	fetchUser: true
}));

/**
 * 登录
 */
AV.Cloud.define('login', function(req, res) {
	var username = req.params.username;
	var password = req.params.password;
	AV.User.logIn(username, password).then(function() {
		// 成功了，现在可以做其他事情了
		res.success('登录成功');
	}, function() {
		// 失败了
		res.error('登录失败');
	});
});

app.post('/login', function(req, res) {
	AV.User.logIn(req.param('username'), req.param('password')).then(function(user) {
		//登录成功，AV.Cloud.CookieSession 会自动将登录用户信息存储到 cookie
		console.log('signin successfully: %j', user);
		res.json({
			success: true
		});
	}, function(error) {
		res.json({
			success: false
		});
	});
});

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 加载云代码方法
app.use(cloud);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(cookieParser());

// 未处理异常捕获 middleware
app.use(function(req, res, next) {
	var d = null;
	if (process.domain) {
		d = process.domain;
	} else {
		d = domain.create();
	}
	d.add(req);
	d.add(res);
	d.on('error', function(err) {
		console.error('uncaughtException url=%s, msg=%s', req.url, err.stack ||
			err.message || err);
		if (!res.finished) {
			res.statusCode = 500;
			res.setHeader('content-type', 'application/json; charset=UTF-8');
			res.end('uncaughtException');
		}
	});
	d.run(next);
});

app.get('/', function(req, res) {
	res.render('index', {
		currentTime: new Date(),
		appName: '包子的杂货铺'
	});
});

app.get('/main', function(req, res) {
	var currentUser = req.AV.user;
	if (currentUser) {
		res.render('main', {
			currentTime: new Date(),
			appName: '包子的杂货铺'
		});
	} else {
		res.redirect('/');
	}
});

// 上传接口方法（使用时自行配置到 router 中）
function uploadFile(req, res) {
	if (req.busboy) {
		var base64data = [];
		var pubFileName = '';
		var pubMimeType = '';
		req.busboy.on('file', function(fieldname, file, fileName, encoding, mimeType) {
			var buffer = '';
			pubFileName = fileName;
			pubMimeType = mimeType;
			file.setEncoding('base64');
			file.on('data', function(data) {
				buffer += data;
			}).on('end', function() {
				base64data.push(buffer);
			});
		}).on('finish', function() {
			var f = new AV.File(pubFileName, {
				// 仅上传第一个文件（多个文件循环创建）
				base64: base64data[0]
			});
			try {
				f.save().then(function(fileObj) {
					// 向客户端返回数据
					res.send({
						fileId: fileObj.id,
						fileName: fileObj.name(),
						mimeType: fileObj.metaData().mime_type,
						fileUrl: fileObj.url()
					});
				});
			} catch (err) {
				console.log('uploadFile - ' + err);
				res.status(502);
			}
		})
		req.pipe(req.busboy);
	} else {
		console.log('uploadFile - busboy undefined.');
		res.status(502);
	}
};

app.post('/uploadPicInterface', uploadFile);

app.get('/uploadPic', function(req, res) {
	var currentUser = req.AV.user;
	if (currentUser) {
		res.render('uploadPic', {
			title: '上传图片'
		});
	} else {
		res.redirect('/');
	}
});

// 可以将一类的路由单独保存在一个文件中
app.use('/wechat', wechat);

// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) { // jshint ignore:line
		var statusCode = err.status || 500;
		if (statusCode === 500) {
			console.error(err.stack || err);
		}
		res.status(statusCode);
		res.render('error', {
			message: err.message || err,
			error: err
		});
	});
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function(err, req, res, next) { // jshint ignore:line
	res.status(err.status || 500);
	res.render('error', {
		message: err.message || err,
		error: {}
	});
});

module.exports = app;