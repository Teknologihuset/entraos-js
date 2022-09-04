import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.render('users', { user: req.session.user });
});

export default router;
