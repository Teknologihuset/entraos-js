import express, { Express, Request, Response } from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import helmet from "helmet";
import session from "express-session";
import {Strategy, TokenSet} from "openid-client";
import EntraClient from "../client/EntraClient";
import path from "path";
import logger from "morgan";
import createError from "http-errors";
import type { ErrorRequestHandler } from "express";

import indexRouter from "../routes/index";
import usersRouter from "../routes/users"

const app: Express = express();
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, "..", "views"));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "..", "public")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);

EntraClient.getOidcClient().then(client => {

    let cookie = {};
    if (app.get('env') === 'production') {
        cookie = { secure: true };
    }

    app.use(
        session({
            secret: 'secret',
            resave: false,
            saveUninitialized: false,
            cookie
        })
    );

    passport.use(
        'oidc',
        new Strategy({ client }, (req, tokenSet, userinfo, done) => {
            console.log("TOKENS: ", tokenSet);
            console.log("USERINFO: ", userinfo);
            return done(null, tokenSet.claims());
        })
    );

    app.use(helmet());
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function(user, cb) {
        cb(null, user);
    });

    passport.deserializeUser(function(obj, cb?: any) {
        cb(null, obj);
    });

    app.use((req, res, next) => {
        res.locals.isAuthenticated = req.isAuthenticated();
        next();
    });

    app.use('/user', usersRouter);

    app.get('/login', (req, res, next) => {
        passport.authenticate(
            "oidc",
            {scope: "openid email profile"})
        (req, res, next);
    });

    app.get('/login/callback0', (req, res, next) => {
        passport.authenticate(
            'oidc',
            {successRedirect: '/user', failureRedirect: '/'})
        (req, res, next);
    });

    app.get(
        "/login/callback",
        (req, res, next) => {
        passport.authenticate("oidc", (err, user, info) => {
            if (err) {
                return next(err);
            }
            if (info) {
                console.log("INFO:", info);
            }
            if (!user) {
                console.error("ERROR: No user object error.")
                return res.render("error", {error: err ? err : getDefaultErr("User object is null.")});
            }
            req.logIn(user, (err) => {
                if (err) {
                    console.error("ERROR: req.logIn");
                    return next(err);
                }
                res.redirect("/user");
            });
        })(req, res, next);
    });

    app.get('/logout', (req, res) => {
        res.redirect(client.endSessionUrl());
    });

    app.get('/logout/callback', (req, res) => {
        req.logout(err => {
            handleErrorLogging(req, err);
        });
        res.redirect('/');
    });

    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        next(createError(404));
    });

    // error handler
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        console.log("Error handler called.");
        res.locals.error =  err ? err : { // req.app.get('env') === 'development' &&
            error: getDefaultErr()
        };

        handleErrorLogging(req, err);

        if (res.headersSent) {
            return next(err)
        }

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    };

    app.use(errorHandler);

})

function handleErrorLogging(req: Request, err?: any) {
    if (req.app.get('env') === 'development' || process.env.NODE_ENV === 'development') {
        console.error("ERROR: ", err);
    }
}

function getDefaultErr(errorStr?: string) {
    return {
        message: errorStr ? errorStr : "Internal server error.",
        status: 500,
        stack: []
    };
}

export default {
    startServer: () => app.listen(port, () => {
        console.log(`Started on http://localhost:${port}`);
    })
}
