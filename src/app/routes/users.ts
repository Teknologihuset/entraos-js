import express from 'express';
import {ensureLoggedIn} from "connect-ensure-login";
const router = express.Router();

/* GET users listing. */
router.get('/', ensureLoggedIn('/'), (req, res) => {
  res.render('users', { user: req.user });
});

export default router;
