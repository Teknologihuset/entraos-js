import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded());
app.use(cookieParser(process.env.COOKIE_SECRET as string || "test"));

app.post("/api/login", (req, res) => {
    const { access_token } = req.body;
    res.cookie("access_token", access_token, { signed: true });
    res.sendStatus(200);
});

app.delete("/api/login", (req, res) => {
    console.log("Called delete on /api/login from ", req.path)
    res.clearCookie("access_token");
    res.sendStatus(200);
});

app.get('/', (req: Request, res: Response) => {
    console.log("Called / from ", req.path)
    res.send('Express + TypeScript Server');
});

export default {
    startServer: () => app.listen(port, () => {
        console.log(`Started on http://localhost:${port}`);
    })
}