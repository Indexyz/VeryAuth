const should = require("should");
const request = require("supertest");
const db = require("mongoose");
const userSchema = require('../Db/Schema/User');
const logSchema = require('../Db/Schema/Log');
const DbDefine = require('../Define/Db');
const stringLib = require('../Utils/String');
const co = require("co");

const userService = require('../Db/Service/userService');
const profileService = require('../Db/Service/profileService');

let application = require("../App"),
    userModel = db.model(DbDefine.Db.USER_DB, userSchema),
    logModel = db.model(DbDefine.Db.LOGS_DB, logSchema);

describe("API", function(){
    var user, password, profile;
    
    beforeEach(function(done){
        co(function*() {
            password = stringLib.randomString(16)
            const tuser = yield userService.create(stringLib.randomString(8), stringLib.randomString(8) + "@email.com", password)
            user = tuser; 
            const tprofile = yield userService.getProfile(user)
            if (!tprofile) throw new Error("Don't get profile")
            profile = tprofile
        }).then(() => done()).catch(err => done(err))
    })
    
    describe("Mojang API", function(){
        it("Header error", function(done){
            request(application)
                .get("/api/authserver")
                .expect(415)
                .end(function(err, res){
                    if (err) return done(err);
                    res.text.indexOf("Unsupported Media Type").should.not.equal(-1);
                    done();
                })
        })
        it("Method error", function(done){
            request(application)
                .get("/api/authserver")
                .set("content-type", "application/json")
                .expect(405)
                .end(function(err, res){
                    if (err) return done(err);
                    res.text.indexOf("Method Not Allowed").should.not.equal(-1);
                    done();
                })
        })
        describe("User Inferce", function(){

            beforeEach(done => {
                userModel.findOne({
                    _id: user._id
                }).then(doc => {
                    user = doc;
                    done();
                })
            })

            it("test authenticate", function(done){
                this.timeout(6000)
                request(application)
                    .post("/api/authserver/authenticate")
                    .set("content-type", "application/json")
                    .send({
                        username: user.email,
                        password: password
                    })
                    .expect(200)
                    .end(function(err, res){
                        if (err) return done(err)
                        let jsonObj = JSON.parse(res.text);
                        userModel.findOne({
                            _id: user._id
                        }).then(doc => {
                            co(function* () {
                                const profile = yield profileService.getProfileById(doc.selectProfile)
                                jsonObj.accessToken.should.equal(profile.accessToken)
                                jsonObj.clientToken.should.equal(profile.clientToken)
                                jsonObj.selectedProfile.id.should.equal(profile.ProfileID)
                                jsonObj.selectedProfile.name.should.equal(profile.UserName)
                            }).then(() => done())
                    })
                })
            })

            it("test error password when authenticate", function(done){
                request(application)
                    .post("/api/authserver/authenticate")
                    .set("content-type", "application/json")
                    .send({
                        username: user.email,
                        password: "err"
                    })
                    .expect(403)
                    .end(done)
            })

            it("test refresh", function(done){
                request(application)
                    .post("/api/authserver/refresh")
                    .set("content-type", "application/json")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: profile.clientToken
                    })
                    .expect(200)
                    .end(function(err, res){
                    
                        if (err) return done(err)
                
                        let jsonObj = JSON.parse(res.text);
                        // Refresh Docment because doc is change
                        co(function* () {
                            const profile = yield profileService.getProfileById(user.selectProfile)
                            jsonObj.accessToken.should.equal(profile.accessToken)
                            jsonObj.clientToken.should.equal(profile.clientToken)
                            jsonObj.selectedProfile.id.should.equal(profile.ProfileID)
                            jsonObj.selectedProfile.name.should.equal(profile.UserName)
                        }).then(() => done())
                    })
            })

            it("test refresh with error token", function(done){
                request(application)
                    .post("/api/authserver/refresh")
                    .set("content-type", "application/json")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: "error-client-token"
                    })
                    .expect(403)
                    .end(done)
            })

            it("test refresh with select profile", function(done){
                request(application)
                    .post("/api/authserver/refresh")
                    .set("content-type", "application/json")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: profile.clientToken,
                        selectedProfile: "true"
                    })
                    .expect(400)
                    .end(done)
            })
            
            it("test validate", function(done){
                request(application)
                    .post("/api/authserver/validate")
                    .set("content-type", "application/json")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: profile.clientToken,
                    })
                    .expect(204)
                    .end(done)
            })

            it("test validate with error token", function(done){
                request(application)
                    .post("/api/authserver/validate")
                    .set("content-type", "application/json")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: "error-client-token",
                    })
                    .expect(403)
                    .end(done)
            })

            it("test signout", function(done){
                request(application)
                    .post("/api/authserver/signout")
                    .set("content-type", "application/json")
                    .send({
                        username: user.email,
                        password: password
                    })
                    .expect(204)
                    .end(done)
            })

            it("test signout with error", function(done){
                request(application)
                    .post("/api/authserver/signout")
                    .set("content-type", "application/json")
                    .send({
                        username: user.email,
                        password: "error"
                    })
                    .expect(403)
                    .end(done)
            })

            it("test invalidate", function(done){
                request(application)
                    .post("/api/authserver/invalidate")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: profile.clientToken,
                    })
                    .expect(204)
                    .end(done)
            })

            it("test invalidate with error token", function(done){
                request(application)
                    .post("/api/authserver/invalidate")
                    .send({
                        accessToken: profile.accessToken,
                        clientToken: "error-client-token",
                    })
                    .expect(204)
                    .end(done)
            })

        })
    })

    describe("Skin", function(){

        it("get skin with error user", function(done){
            request(application)
                .get("/api/skin/not-exist.json")
                .expect(401)
                .end(done)
        })

        it("get skin", function(done){
            request(application)
                .get("/api/skin/" + profile.UserName + ".json")
                .expect(200)
                .end(done)
        })

        it("get user cap", function(done){
            request(application)
                .get("/api/skin/cap/" + profile.UserName + ".png")
                .expect(302)
                .end(done)
        })

        it("get user skin", function(done){
            request(application)
                .get("/api/skin/skin/" + profile.UserName + ".png")
                .expect(302)
                .end(done)
        })

        it("get user uuid skin with error uuid", function(done){
            request(application)
                .get("/api/skin/uskin/notauuid.png")
                .expect(302)
                .end(function(err, res){
                    if (err) return done(err);
                    res.text.should.equal("Found. Redirecting to https://public.hyperworld.xyz/Gamer/Minecraft/public.png");
                    done()
                });
        })

        it("get user uuid skin", function (done) {
            request(application)
                .get("/api/skin/uskin/" + profile.ProfileID + ".png")
                .expect(302)
                .end(done);
        })

        it("get user resources without id", function(done){
            request(application)
                .get("/api/skin/textures/")
                .set("content-type", "application/json")
                .expect(404)
                .end(done)
        })

        it("get user resources with undefined id", function(done){
            request(application)
                .get("/api/skin/textures/undefined")
                .set("content-type", "application/json")
                .expect(404)
                .end(done)
        })

        it("get user resources", function(done){
            request(application)
                .get("/api/skin/textures/user-res")
                .set("content-type", "application/json")
                .expect(302)
                .end(done)
        })

    })

    describe("Yggdrasil", function(){
        var serverId, tp, tu;
        before(function(done){
            co(function* () { 
                serverId = stringLib.randomString(16)
                const tuser = yield userService.create(stringLib.randomString(8), stringLib.randomString(8) + "@emmail.com", password)
                if (!tuser) { throw new Error("No user found"); }
                tu = tuser; 
                const tprofile = yield userService.getProfile(user)
                if (!tprofile) throw new Error("Don't get profile")
                tp = tprofile
            }).then(() => done()).catch(err => done(err))
        })

        it("has joinserver before join server", function(done){
            request(application).get("/api/sessionserver/session/minecraft/hasJoined?serverId=" + serverId + "&username=" + tp.UserName)
            .set("content-type", "application/json")
            .expect(204)
            .end(done)
        })

        it("test joinserver", function(done){
            request(application).post("/api/sessionserver/session/minecraft/join")
            .set("content-type", "application/json")
            .send({
                accessToken: tp.accessToken,
                selectedProfile: tp.ProfileID,
                serverId: serverId
            })
            .expect(204)
            .end(done)
        })
        
        it("test join server with unknow profile", function(done){
            request(application).post("/api/sessionserver/session/minecraft/join")
            .set("content-type", "application/json")
            .send({
                accessToken: "error access token",
                selectedProfile: tp.ProfileID,
                serverId: serverId
            })
            .expect(403)
            .end(done)
        })

        it("test join server with error serverId", function(done){
            request(application).get("/api/sessionserver/session/minecraft/hasJoined?serverId=test&username=" + tp.UserName)
            .set("content-type", "application/json")
            .expect(204)
            .end(done)
        })

        it("test has join server", function(done){
            request(application).get("/api/sessionserver/session/minecraft/hasJoined?serverId=" + serverId + "&username=" + tp.UserName)
            .set("content-type", "application/json")
            .expect(200)
            .end(function(err, res) {
                if (err) return done(err);
                jsonObj = JSON.parse(res.text)
                jsonObj.should.not.be.null();
                co(function* (){
                    const newProfile = yield profileService.getProfileByProfileId(tp.ProfileID)
                    jsonObj.id.should.be.equal(newProfile.ProfileID)
                    jsonObj.name.should.be.equal(newProfile.UserName)
                }).then(() => done())
            })
        })

        it("username2uuid with error username", function(done){
            request(application).get("/api/sessionserver/session/minecraft/profile/error-name")
            .set("content-type", "application/json")
            .expect(204)
            .end(done)
        })

        it("username2uuid", function(done){
            request(application).get("/api/sessionserver/session/minecraft/profile/" + tp.ProfileID)
            .set("content-type", "application/json")
            .expect(200)
            .end(function(err, res) {
                if (err) return done(err);
                jsonObj = JSON.parse(res.text)
                jsonObj.should.not.be.null();
                co(function*() {
                    const newProfile = yield profileService.getProfileByProfileId(tp.ProfileID)
                    jsonObj.id.should.be.equal(newProfile.ProfileID)
                    jsonObj.name.should.be.equal(newProfile.UserName)
                }).then(() => done())
            })
        })

        // it("uuid to username", function(done){
        //     request(application).get("/api/yggdrasil/profiles/" + tp.ProfileID + "/names")
        //     .expect(200)
        //     .end(function(err, res){
        //         if (err) return done(err);
        //         res.text.should.equal('[{"name":"' + tp.UserName + '"}]')
        //         done()
        //     })
        // })

        // it("uuid to username with errro uuid", function(done){
        //     request(application).get("/api/yggdrasil/profiles/error-uuid/names")
        //     .expect(204)
        //     .end(done)
        // })
        
        it("uuid to usernames", function(done){
            request(application).post("/api/api/profiles/minecraft")
            .set("content-type", "application/json")
            .send([
                tp.UserName,
                profile.UserName
            ])
            .expect(200)
            .end(done)
        })

        it("uuid with error usernames", function(done){
            request(application).post("/api/api/profiles/minecraft")
            .set("content-type", "application/json")
            .send([
                "error-user-name"
            ])
            .expect(200)
            .end(done)
        })


        it("uuid to usernames with none args", function(done){
            request(application).post("/api/api/profiles/minecraft")
            .set("content-type", "application/json")
            .expect(200)
            .end(done)
        })

        after(function(done){
            userModel.remove({
                _id: tu._id
            }).then(er => done())
        })

    })

    afterEach(function(done){
        userModel.remove({
            _id: user._id
        }, err => {
            if (err) return done(err)
            done();
        })
    })
})