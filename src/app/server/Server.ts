import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import passport from "passport";
import helmet from "helmet";
import session from "express-session";
import {Strategy} from "openid-client";
import EntraClient from "../client/EntraClient";
import ensure from 'connect-ensure-login';
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

    app.use(session({
        secret: 'secret',
        resave: false,
        saveUninitialized: true,})
    );
    app.use(helmet());
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        'oidc',
        new Strategy({ client }, (req, tokenSet, userinfo, done) => {
            return done(null, tokenSet.claims());
        })
    );

    passport.serializeUser(function(user, cb) {
        cb(null, user);
    });

    passport.deserializeUser(function(obj, cb) {
        // @ts-ignore
        cb(null, obj);
    });

    app.get('/login', (req, res, next) => {
        passport.authenticate('oidc',{scope:"openid"})(req, res, next);
    });

    app.get('/login/callback', (req, res, next) => {
        passport.authenticate('oidc', {
            successRedirect: '/users',
            failureRedirect: '/'
        })(req, res, next);
    });

    app.use('/users', usersRouter);

    app.get('/logout', (req, res) => {
        res.redirect(client.endSessionUrl());
    });

    app.get('/logout/callback', (req, res) => {
        req.logout(err => {
            console.error(err);
        });
        res.redirect('/');
    });

    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        next(createError(404));
    });

    // error handler
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    };

    app.use(errorHandler);

})

export default {
    startServer: () => app.listen(port, () => {
        console.log(`Started on http://localhost:${port}`);
    })
}
