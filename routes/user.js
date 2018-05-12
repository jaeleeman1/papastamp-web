var express = require('express');
var router = express.Router();
var config = require('../config/service_config');
var getConnection = require('../config/db_connection');
var logger = require('../config/logger');
var mysql = require('mysql');
var admin = require("firebase-admin");
var crypto = require( "crypto" );
var serviceAccount = require("../config/papastamp-a72f6-firebase-adminsdk-qqp2q-6484dc5daa.json");

const TAG = '[USER INFO] ';

var encryptUid = function(unumber) {
    unumber = unumber.replace(/-/gi, '');
    unumber = '082'+ unumber;
    var secrect = config.secrectKey;
    var cipher = crypto.createCipher("aes-128-ecb", secrect);
    var crypted = cipher.update(unumber, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://papastamp-a72f6.firebaseio.com"
});

/* GET encrypt uid */
router.get('/couponCheck', function(req, res, next) {
    var userNumber = req.query.user_number;
    var shopId = req.query.shop_id;

    logger.debug(TAG, 'Phone ID : ' + userNumber);
    logger.debug(TAG, 'Encrypted ID : ' + crypted);

    getConnection(function (err, connection) {
        var selectStampCount = 'select USER_STAMP from SB_USER_PUSH_INFO ' +
            'where DEL_YN = "N" and SHOP_ID = ' + mysql.escape(shopId) + ' and USER_ID = ' + mysql.escape(crypted);
        connection.query(selectStampCount, function (err, selectStampCountData) {
            if (err) {
                logger.error(TAG, "DB Select stamp count error : " + err);
                res.status(400);
                res.send('Select stamp count error');
            } else {
                logger.debug(TAG, 'Select stamp count success');

                var selectCouponQuery = 'select COUPON_NAME, COUPON_NUMBER, EXPIRATION_DT from SB_USER_COUPON ' +
                    'where SHOP_ID = '+mysql.escape(shopId)+' and USER_ID = '+mysql.escape(crypted) +' and MAPPING_YN="Y" and USED_YN="N"';
                connection.query(selectCouponQuery, function (err, selectCouponData) {
                    if (err) {
                        logger.error(TAG, "Select Coupon error : " + err);
                        res.status(400);
                        res.send('Select coupon error');
                    } else {
                        logger.debug(TAG, 'Select coupon success');
                        if(selectStampCountData.length > 0) {
                            res.send({cryptedData: crypted, userStamp: selectStampCountData[0].USER_STAMP, selectCouponData: selectCouponData});
                        }else {
                            res.send({userId: encryptUid(userNumber), userStamp: 0, selectCouponData: selectCouponData});
                        }
                    }
                });
            }
            connection.release();
        });
    });
});

//Get User Location
router.get('/userLocation', function (req, res, next) {
    logger.info(TAG, 'Get user location');

    var userId = req.headers.user_id;
    logger.debug(TAG, 'User id : ' + userId);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid user id parameter error');
        res.status(400);
        res.send('Invalid user id parameter error');
    }

    getConnection(function (err, connection){
        var selectUserLocationQuery = 'select SUI.CURRENT_LAT, SUI.CURRENT_LNG from SB_USER_INFO as SUI ' +
            'where SUI.USER_ID =' + mysql.escape(userId);
        connection.query(selectUserLocationQuery, function (err, userLocationData) {
            if (err) {
                logger.error(TAG, "Select user location error : " + err);
                res.status(400);
                res.send('Select user location error');
            }else{
                logger.debug(TAG, 'Select user location success : ' + JSON.stringify(userLocationData));
                res.status(200);
                res.send({userLocationData:userLocationData[0]});
            }
            connection.release();
        });
    });
});

// Get User Login
router.post('/userLogin', function(req, res, next) {
    logger.info(TAG, 'Get user login');

    var userId = req.headers.user_id;
    logger.debug(TAG, 'User ID : ' + userId);

    var userEmail = req.body.user_email;
    var userPassword = req.body.user_password;

    logger.debug(TAG, 'Login EMAIL : ' + userEmail);
    logger.debug(TAG, 'Login PW : ' + userPassword);

    if(userEmail == null || userEmail == undefined &&
        userPassword == null || userPassword == undefined) {
        logger.debug(TAG, 'Invalid parameter');
        res.status(400);
        res.send('Invalid parameter error');
    }

    getConnection(function (err, connection){
        var userEmailCheck = '0';
        var userPwCheck = '0';
        var selectLoginQuery = "select USER_ID, USER_PASSWORD, (select exists (select * from SB_USER_INFO where USER_EMAIL = "+ mysql.escape(userEmail) + ")) as EMAIL_CHECK" +
            " from SB_USER_INFO where USER_TYPE = 100 and USER_EMAIL = "+ mysql.escape(userEmail);
        connection.query(selectLoginQuery, function (err, userLogin) {
            if (err) {
                logger.error(TAG, "DB selectLoginQuery error : " + err);
                res.status(400);
                res.send('User sign in error');
            }else{
                logger.debug(TAG, 'Select user login success : ' + JSON.stringify(userLogin));
                if(userLogin.length < 1) {
                    res.status(500);
                    res.send('No user info');
                }else {
                    var userInfo = {
                        user_id : userId
                    }

                    userEmailCheck = userLogin[0].EMAIL_CHECK

                    if(userLogin[0].USER_PASSWORD == userPassword) {
                        userPwCheck = '1';
                    }
                    // req.session.userInfo = userInfo;
                    res.send({userId: userLogin[0].USER_ID, userEmailCheck: userEmailCheck, userPwCheck: userPwCheck});
                }
            }
            connection.release();
        });
    });
});

// Get Firebase User Create
router.get('/userCreate', function(req, res, next) {
    logger.info(TAG, 'Get user auth');

    var userId = req.headers.user_id;
    logger.debug(TAG, 'User ID : ' + userId);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid headers value');
        res.status(400);
        res.send('Invalid headers error');
    }

    admin.auth().createCustomToken(userId)
        .then(function(customToken) {
            // Send token back to client
            logger.debug(TAG, 'Custom token : ', customToken);
            res.send({customToken:customToken});
        })
        .catch(function(error) {
            logger.error(TAG, 'Error creating custom token : ', error);
            console.log("Error creating custom token:", error);
        });
});

/* POST user info */
router.post('/userInfo', function(req, res, next) {
    var userId = req.headers.user_id;
    var accessToken = req.body.access_token;
    var userEmail = req.body.user_email;
    var userPassword = req.body.user_password;

    getConnection(function (err, connection){
        var selectLoginCheckQuery = "select exists (select * from SB_USER_INFO where USER_EMAIL = "+ mysql.escape(userEmail) + ") as EMAIL_CHECK";
        connection.query(selectLoginCheckQuery, function (err, userLoginCheck) {
            if (err) {
                logger.error(TAG, "DB selectLoginQuery error : " + err);
                res.status(400);
                res.send('User sign in error');
            }else{
                logger.debug(TAG, 'Select user login success : ' + JSON.stringify(userLoginCheck));
                // Insert User Infomation
                if(userLoginCheck[0].EMAIL_CHECK ==  '0') {
                    var insertUserInfo = "insert into SB_USER_INFO (USER_ID, ACCESS_TOKEN, USER_EMAIL, USER_PASSWORD, USER_TYPE) " +
                        "values(" + mysql.escape(userId) + "," + mysql.escape(accessToken) + "," + mysql.escape(userEmail) + ",password(" + mysql.escape(userPassword) + "), '100') " +
                        "on duplicate key update ACCESS_TOKEN=" + mysql.escape(accessToken) + ", USER_EMAIL=" + mysql.escape(userEmail) + ", USER_PASSWORD=" + mysql.escape(userPassword) + ", USER_TYPE=100";
                    connection.query(insertUserInfo, function (err, userInfoData) {
                        if (err) {
                            logger.error(TAG, "Insert User Info Error : " + err);
                            res.status(500);
                            throw err;
                        } else {
                            logger.debug(TAG, "Insert User Info Success ### " + JSON.stringify(userInfoData));
                            res.status(200);
                            res.send();
                        }
                    });
                }else {
                    res.status(400);
                    res.send();
                }
            }
            connection.release();
        });
    });
});

//Put User Location
router.put('/accessToekn', function (req, res, next) {
    logger.info(TAG, 'Update user location');

    var userId = req.headers.user_id;
    var accessToken = req.body.access_token;

    logger.debug(TAG, 'User iD : ' + userId);
    logger.debug(TAG, 'Access Token : ' + accessToken);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid user id value');
        res.status(400);
        res.send('Invalid user id error');
    }

    if(accessToken == null || accessToken == undefined) {
        logger.debug(TAG, 'Invalid access token value');
        res.status(400);
        res.send('Invalid access token error');
    }

    getConnection(function (err, connection){
        var updateAccessTokenQuery = 'insert into SB_USER_INFO (ACCESS_TOKEN) value ("'+ accessToken +'") ' +
            'on duplicate key update USER_ID = "'+ userId;
        connection.query(updateAccessTokenQuery, function (err, accessTokenData) {
            if (err) {
                logger.error(TAG, "DB updateUserLocationQuery error : " + err);
                res.status(400);
                res.send('Update access token error');
            }else{
                logger.debug(TAG, 'Update access token success');
                res.status(200);
                res.send();
            }
            connection.release();
        });
    });
});

//Get User Location
router.get('/accessToken', function (req, res, next) {
    logger.info(TAG, 'Update user location');

    var userId = req.headers.user_id;

    logger.debug(TAG, 'User ID : ' + userId);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid user id value');
        res.status(400);
        res.send('Invalid user id error');
    }

    getConnection(function (err, connection){
        var getAccessTokenQuery = 'select ACCESS_TOKEN from SB_USER_INFO ' +
            'where USER_ID = "'+ userId + '"';
        console.log(getAccessTokenQuery);
        connection.query(getAccessTokenQuery, function (err, accessTokenData) {
            if (err) {
                logger.error(TAG, "DB updateUserLocationQuery error : " + err);
                res.status(400);
                res.send('Update access token error');
            }else{
                logger.debug(TAG, 'Update access token success', accessTokenData);
                res.status(200);
                res.send({result:"success", accessToken:accessTokenData[0].ACCESS_TOKEN});
            }
            connection.release();
        });
    });
});

//Put User Location
router.put('/updateLocation', function (req, res, next) {
    logger.info(TAG, 'Update user location');

    var userId = req.headers.user_id;
    var currentLat = req.body.latitude;
    var currentLng = req.body.longitude;

    logger.debug(TAG, 'User iD : ' + userId);
    logger.debug(TAG, 'Current latitude : ' + currentLat);
    logger.debug(TAG, 'Current longitude : ' + currentLng);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid user id value');
        res.status(400);
        res.send('Invalid user id error');
    }

    if(currentLat == null || currentLat == undefined ||
        currentLng == null || currentLng == undefined) {
        logger.debug(TAG, 'Invalid location parameter error');
        res.status(400);
        res.send('Invalid location parameter error');
    }

    getConnection(function (err, connection){
        var updateUserLocationQuery = 'insert into SB_USER_INFO (USER_ID, CURRENT_LAT, CURRENT_LNG) value ("'+ userId +'", "'+ currentLat +'", "' + currentLng +'") ' +
            'on duplicate key update CURRENT_LAT = "'+ currentLat +'", CURRENT_LNG = "'+ currentLng +'"';
        connection.query(updateUserLocationQuery, function (err, userLocationData) {
            if (err) {
                logger.error(TAG, "DB updateUserLocationQuery error : " + err);
                res.status(400);
                res.send('Update user location error');
            }else{
                logger.debug(TAG, 'Update user location success');
                res.status(200);
                res.send();
            }
            connection.release();
        });
    });
});

//Update User Signout
router.put('/userSignout', function (req, res, next) {
    logger.info(TAG, 'Update user signout');

    var userId = req.headers.user_id;
    logger.debug(TAG, 'User iD : ' + userId);

    if(userId == null || userId == undefined) {
        logger.debug(TAG, 'Invalid user id value');
        res.status(400);
        res.send('Invalid user id error');
    }

    getConnection(function (err, connection){
        var deleteUserInfo = 'update SB_USER_INFO set DEL_YN = "Y" ' +
            'where USER_ID = ' +mysql.escape(userId);
        connection.query(deleteUserInfo, function (err, deleteUserInfoData) {
            if (err) {
                logger.error(TAG, "Update user info error : " + err);
                res.status(400);
                res.send('Update user info error');
            }else{
                logger.debug(TAG, 'Update user info success : ' + JSON.stringify(deleteUserInfoData));
                var deleteUserPushHis = 'update SB_USER_PUSH_HIS set DEL_YN = "Y" ' +
                    'where USER_ID = ' +mysql.escape(userId);
                connection.query(deleteUserPushHis, function (err, deleteUserPushHisData) {
                    if (err) {
                        logger.error(TAG, "Update user push history error : " + err);
                        res.status(400);
                        res.send('Update user push history error');
                    }else {
                        logger.debug(TAG, 'Update user push history success : ' + JSON.stringify(deleteUserPushHisData));
                        var deleteUserPushInfo = 'update SB_USER_PUSH_INFO set DEL_YN = "Y" ' +
                            'where USER_ID = ' +mysql.escape(userId);
                        connection.query(deleteUserPushInfo, function (err, deleteUserPushInfoData) {
                            if (err) {
                                logger.error(TAG, "Update user push info error : " + err);
                                res.status(400);
                                res.send('Update user push info error');
                            }else {
                                logger.debug(TAG, 'Update user push info success : ' + JSON.stringify(deleteUserPushInfoData));
                                res.status(200);
                                res.send({success: 'success'});
                            }
                        });
                    }
                });
            }
            connection.release();
        });
    });
});

//Get Beacon to shop id
router.get('/beaconToShopId/:beacon_code', function (req, res, next) {
    logger.info(TAG, 'Get shop beacon');

    var beaconCode = req.params.beacon_code;
    logger.debug(TAG, 'shop beacon : ' + beaconCode);

    if(beaconCode == null || beaconCode == undefined) {
        logger.debug(TAG, 'Invalid shop beacon parameter error');
        res.status(400);
        res.send('Invalid shop beacon parameter error');
    }

    getConnection(function (err, connection){
        var selectShopIdQuery = 'select SHOP_ID from SB_SHOP_INFO as SSI ' +
            'where SSI.SHOP_BEACON =' + mysql.escape(beaconCode);
        connection.query(selectShopIdQuery, function (err, shopIdData) {
            if (err) {
                logger.error(TAG, "Select shop id error : " + err);
                res.status(400);
                res.send('Select shop id error');
            }else{
                logger.debug(TAG, 'Select shop id success : ' + JSON.stringify(shopIdData));
                res.status(200);
                res.send({shopId:shopIdData[0].SHOP_ID});
            }
            connection.release();
        });
    });
});

//Get Beacon to shop id
router.get('/shopIdToBeacon', function (req, res, next) {
    logger.info(TAG, 'Get shop beacon');

    var shopId = req.query.shop_id;
    logger.debug(TAG, 'Shop iD : ' + shopId);

    if(shopId == null || shopId == undefined) {
        logger.debug(TAG, 'Invalid shop id value');
        res.status(400);
        res.send('Invalid shop id error');
    }

    getConnection(function (err, connection){
        var selectBeaconIdQuery = 'select SHOP_BEACON from SB_SHOP_INFO as SSI ' +
            'where SSI.SHOP_ID =' + mysql.escape(shopId);
        connection.query(selectBeaconIdQuery, function (err, shopBeaconData) {
            if (err) {
                logger.error(TAG, "Select shop beacon error : " + err);
                res.status(400);
                res.send('Select shop beacon error');
            }else{
                logger.debug(TAG, 'Select shop beacon success : ' + JSON.stringify(shopBeaconData));
                res.status(200);
                res.send({shopBeacon:shopBeaconData[0].SHOP_BEACON});
            }
            connection.release();
        });
    });
});

//Get Shop code to shop id
router.get('/shopCodeToShopId/:shop_code', function (req, res, next) {
    logger.info(TAG, 'Get shop code');

    var shopCode = req.params.shop_code;
    logger.debug(TAG, 'Shop Code : ' + shopCode);

    if(shopCode == null || shopCode == undefined) {
        logger.debug(TAG, 'Invalid shop code parameter error');
        res.status(400);
        res.send('Invalid shop code parameter error');
    }

    getConnection(function (err, connection){
        var selectShopCodeQuery = 'select SHOP_MAJOR_MINOR, SHOP_ID, SHOP_BEACON from SB_SHOP_INFO as SSI ' +
            'where SSI.SHOP_MAJOR_MINOR =' + mysql.escape(shopCode);
        connection.query(selectShopCodeQuery, function (err, shopCodeIdData) {
            if (err) {
                logger.error(TAG, "Select shop code, id error : " + err);
                res.status(400);
                res.send('Select shop code, id error');
            }else{
                logger.debug(TAG, 'Select shop code, id success : ' + JSON.stringify(shopCodeIdData));
                res.status(200);
                res.send({shopCode:shopCodeIdData[0].SHOP_MAJOR_MINOR, shopId:shopCodeIdData[0].SHOP_ID, shopBeacon:shopCodeIdData[0].SHOP_BEACON});
            }
            connection.release();
        });
    });
});

module.exports = router;