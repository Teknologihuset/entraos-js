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

const app: Express = express();
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,})
);
app.use(helmet());
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
    cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
    // @ts-ignore
    cb(null, obj);
});

EntraClient.getOidcClient().then(client => {
    passport.use(
        'oidc',
        new Strategy(
            {client, passReqToCallback: true},
            (req, tokenSet, userinfo, done) => {
                console.log("verifing: ", tokenSet);
                done(null, { token: tokenSet.claims(), ...userinfo });
            })
    );
})

app.get('/', (req: Request, res: Response) => {
    console.log("Called / from ", req.path)
    res.send(" <a href='/login'>Log In with OAuth 2.0 Provider </a>")
});

app.get('/login', async (req: Request, res: Response, next) => {
    console.log("Called /login from ", req.path);
    next();
}, passport.authenticate('oidc',{scope:"openid"}));

app.get('/auth/callback', (req, res, next) => {
    passport.authenticate('oidc', {
        successRedirect: '/users',
        failureRedirect: '/'
    })(req, res, next);
});

app.get ("/user", ensure.ensureLoggedIn(), (req,res) =>{
    res.header("Content-Type",'application/json');
    console.log("Called /user", req)
    // @ts-ignore
    res.end(JSON.stringify({
        // @ts-ignore
        tokenset:req.session.tokenSet,
        // @ts-ignore
        userinfo:req.session.userinfo
    },null,2));
})

export default {
    startServer: () => app.listen(port, () => {
        console.log(`Started on http://localhost:${port}`);
    })
}
