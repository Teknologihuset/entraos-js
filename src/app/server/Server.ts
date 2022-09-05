import express, {Express, NextFunction, Request, RequestHandler, Response} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import session from "express-session";
import {TokenSet, generators, UserinfoResponse} from "openid-client";
import EntraClient from "../client/EntraClient";
import path from "path";
import logger from "morgan";
import createError from "http-errors";
import type {ErrorRequestHandler} from "express";

import indexRouter from "../routes/index";
import usersRouter from "../routes/users"
import {Either, isLeft} from "fp-ts/Either";

type User = {
    id: string;
    email: string;
};

declare module "express-session" {
    interface SessionData {
        user: UserinfoResponse,
        sessionData: {
            code_verifier: string,
            nonce: string,
            state: string
        },
        tokenSet: TokenSet
    }
}

const app: Express = express();
const port = process.env.PORT || 3000;

app.set('views', path.join(__dirname, "..", "views"));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "..", "public")));
app.use(express.urlencoded({extended: false}));

let secret = EntraClient.randomString(32);
app.use(cookieParser(secret));

app.use('/', indexRouter);

EntraClient.getOidcClient().then(client => {

    let cookie = {};
    if (app.get('env') === 'production') {
        cookie = {secure: true};
    }

    app.use(
        session({
            secret,
            resave: false,
            saveUninitialized: false,
            cookie
        })
    );

    app.use(helmet());

    app.use((req, res, next) => {
        res.locals.authenticated = isAuthenticated();
        next();
    });

    app.use('/user', isAuthenticated(), usersRouter);

    app.get('/login', (req, res, next) => {
        const code_verifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(code_verifier);
        const nonce = generators.nonce();
        const state = generators.state();

        req.session.sessionData = {
            code_verifier,
            nonce,
            state
        }

        const authorizationUrl = client.authorizationUrl({
            response_type: "code",
            response_mode: "fragment",
            client_id: client.metadata.client_id,
            scope: 'openid email profile',
            code_challenge,
            code_challenge_method: 'S256',
            state,
            nonce
        });

        res.redirect(authorizationUrl)
    });

    /**
     * client_credentials flow doesn't involve user interaction
     */
    app.get('/client/login', async (req, res) => {

        const tokenEndpoint = client.issuer.metadata.token_endpoint || "";
        const token: Either<Error, TokenSet> = await EntraClient.fetchOneTimeAccessToken(tokenEndpoint, {
            client_id: client.metadata.client_id,
            client_secret: client.metadata.client_secret || ""
        });

        if (isLeft(token)) {
            throw new Error("Couldn't fetch one time access token.", token.left);
        }

        res.json(token.right);
    });

    /**
     * authorization_code flow involves user interaction (user must sign in)
     */
    app.get('/login/callback', async (req, res, next) => {
        console.log("callback called")

        const params = client.callbackParams(req);
        const code_verifier = req.session.sessionData?.code_verifier;
        const state = req.session.sessionData?.state;
        const nonce = req.session.sessionData?.nonce;

        if (!code_verifier) {
            throw new Error("missing code_verifier");
        }

        if (!state || state !== params.state) {
            console.error("ERROR: Invalid state.");
            return res.redirect("/");
        }

        /*if (!nonce || nonce !== params.nonce) {
            console.error("ERROR: Invalid nonce.");
            return res.redirect("/");
        }*/

        if (params.error || params.error_description) {
            console.error("ERROR: params.error: ", params.error_description || params.error);
            return res.redirect("/");
        }

        if (!params.code) {
            return res.status(401).send("Error: invalid state.");
        }

        const parameters = new URLSearchParams();
        parameters.append("grant_type", "authorization_code");
        parameters.append("client_id", client.metadata.client_id);
        parameters.append("client_secret", client.metadata.client_secret || "");
        parameters.append("redirect_uri", "http://127.0.0.1:3000/login/callback");
        parameters.append("code", params.code);
        parameters.append("code_verifier", code_verifier);

        const auth64 = Buffer.from(
            client.metadata.client_id + ":" + client.metadata.client_secret)
            .toString('base64')

        const token_endpoint = client.issuer.metadata.token_endpoint || "";
        console.log("token_endpoint:", token_endpoint)
        console.log("parameters:", parameters)

        const tokenSet = await fetch(token_endpoint, {
            method: "post",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth64}` // this is a required header
            },
            body: parameters,
        });

        if (!tokenSet.ok) {
            const error = new Error(`Status ${tokenSet.status} ${tokenSet.statusText}`)
            console.error("ERROR: Couldn't fetch token:", error);
            console.log(await tokenSet.json()); // prints out error info
            return res.redirect("/");
        } else {
            const tokens: TokenSet = await tokenSet.json();
            console.log('received and validated tokens %j', tokens);
            res.cookie("access_token", tokens.access_token, {signed: true, secure: true, sameSite: "lax", httpOnly: true});
            req.session.tokenSet = tokens;

            const user = await client.userinfo(tokens.access_token!!, {via: "header"});
            if (user) {
                req.session.user = user;
                console.log("USER: ", user);
            }

            return res.json(user);
        }


    });

    function isAuthenticated(redirectTo?: string): RequestHandler {
        return (req: Request, res: Response, next: NextFunction) => {
            console.log(req.signedCookies)
            const {access_token} = req.signedCookies;
            if (access_token) {
                next();
            }
            res.redirect(redirectTo || "/login");
        }
    }

    app.get('/logout', (req, res) => {
        res.clearCookie("access_token");
        res.redirect(client.endSessionUrl({
            post_logout_redirect_uri: "http://localhost:3000/logout/callback"
        }));
    });

    app.get('/logout/callback', (req, res) => {
        res.redirect('/');
    });

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        next(createError(404));
    });

    // error handler
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        console.log("Error handler called.");
        res.locals.error = err ? err : { // req.app.get('env') === 'development' &&
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
