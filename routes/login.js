var express = require('express');
var router = express.Router();
var config = require('../config/service_config');
var getConnection = require('../config/db_connection');
var logger = require('../config/logger');
var mysql = require('mysql');

const TAG = '[LOGIN INFO] ';

/* GET users listing. */
router.get('/', function(req, res, next) {
    var user_email = '';
    if(req.session.userInfo) {
        var userInfo = req.session.userInfo;
        user_email = userInfo.user_email;
        res.render('login', {url:config.url, userEmail: user_email, privacy:"none"});
    }else {
        res.render('login', {url:config.url, userEmail: "E-Mail", privacy:"none"});
    }
});

router.get('/signup', function(req, res, next) {
    var termsYn = req.query.terms_yn;
    var currentLat = req.query.init_lat;
    var currentLng = req.query.init_lng;
    res.render('signup', {url:config.url, termsYn:termsYn, currentLat:currentLat, currentLng:currentLng});
});

router.get('/logout', function(req, res, next) {
    req.session.destory(function(err){
        if(err) logger.err('err', err);
        res.render('papa-admin/admin-signin', {url:config.url, userId: "Username"});
    });
});

router.get('/privacy', function(req, res, next) {
    res.render('login', {url:config.url, userEmail: "E-Mail", privacy:"privacy"});
});

router.get('/oauth', function(req, res, next) {
    var kakaoCode = req.query.code;
    res.render('kakao-login',{kakaoCode:kakaoCode});
});

router.get('/oauth-kakao', function(req, res, next) {
    res.redirect('https://kauth.kakao.com/oauth/authorize?client_id=68feaa126a7ec73d49dc706ae751bfe0&redirect_uri=http://localhost:8080/oauth&response_type=code&scope=talk_message');
});


module.exports = router;