// CodeAlpha Full Stack Internship - Task 1: Simple E-commerce Store
// Express.js + SQLite backend with server-rendered HTML pages.
// Features: product listings, product details, shopping cart,
// order processing, user registration/login, database storage.

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database setup ----------
const db = new Database(path.join(__dirname, 'shop.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL
  );
`);

// Seed sample products on first run
if (db.prepare('SELECT COUNT(*) AS c FROM products').get().c === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, description, price, image, stock) VALUES (?, ?, ?, ?, ?)'
  );
  const samples = [
    ['Wireless Mouse', 'Ergonomic 2.4GHz wireless mouse with long battery life.', 19.99, 'https://placehold.co/300x200?text=Mouse', 25],
    ['Mechanical Keyboard', 'Compact keyboard with tactile blue switches.', 59.99, 'https://placehold.co/300x200?text=Keyboard', 10],
    ['USB-C Hub', '4-in-1 hub with HDMI and two USB 3.0 ports.', 34.5, 'https://placehold.co/300x200?text=Hub', 15],
    ['Laptop Stand', 'Adjustable aluminium stand for better posture.', 29.0, 'https://placehold.co/300x200?text=Stand', 20],
  ];
  samples.forEach((s) => insert.run(...s));
}

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: true,
  })
);

app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = {};
  res.locals.user = req.session.userId
    ? db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.session.userId)
    : null;
  res.locals.cartCount = Object.values(req.session.cart).reduce((a, b) => a + b, 0);
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// ---------- Helpers ----------
function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const money = (n) => `$${Number(n).toFixed(2)}`;

function layout(res, title, body) {
  const u = res.locals.user;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} - Simple Shop</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <a href="/" class="brand">Simple Shop</a>
    <nav>
      <a href="/">Products</a>
      <a href="/cart">Cart (<span id="cart-count">${res.locals.cartCount}</span>)</a>
      ${u
        ? `<a href="/orders">My Orders</a>
           <span class="hello">Hi, ${esc(u.username)}</span>
           <form method="POST" action="/logout" class="inline"><button>Logout</button></form>`
        : `<a href="/login">Login</a><a href="/register">Register</a>`}
    </nav>
  </header>
  <main>${body}</main>
  <footer>CodeAlpha Full Stack Internship - Task 1</footer>
  <script src="/app.js"></script>
</body>
</html>`);
}

// ---------- Static assets (inline for a single-file submission) ----------
app.get('/style.css', (req, res) => {
  res.type('css').send(`
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f5f6fa; color: #222; display: flex; flex-direction: column; min-height: 100vh; }
    header { background: #2c3e50; color: #fff; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    header a { color: #fff; text-decoration: none; margin-left: 16px; }
    .brand { font-size: 1.4em; font-weight: bold; margin-left: 0; }
    .hello { margin-left: 16px; opacity: .85; }
    main { flex: 1; max-width: 1000px; width: 100%; margin: 24px auto; padding: 0 16px; }
    footer { text-align: center; padding: 14px; color: #777; font-size: .9em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
    .card { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.1); display: flex; flex-direction: column; }
    .card img { width: 100%; border-radius: 6px; }
    .card h3 { margin: 10px 0 6px; }
    .price { color: #27ae60; font-weight: bold; font-size: 1.1em; }
    .btn { background: #2980b9; color: #fff; border: none; padding: 9px 16px; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; font-size: 1em; }
    .btn:hover { background: #1f6391; }
    .btn.danger { background: #c0392b; }
    .btn.success { background: #27ae60; }
    .panel { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
    .detail { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .detail img { width: 100%; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; margin-bottom: 4px; font-weight: bold; }
    .form-group input { width: 100%; padding: 9px; border: 1px solid #ccc; border-radius: 5px; font-size: 1em; }
    .error { background: #fdecea; color: #c0392b; padding: 10px; border-radius: 5px; margin-bottom: 14px; }
    .success-msg { background: #e8f8ef; color: #1e8449; padding: 10px; border-radius: 5px; margin-bottom: 14px; }
    .inline { display: inline; }
    .inline button { background: none; border: 1px solid #fff; color: #fff; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 12px; }
    .narrow { max-width: 420px; margin: 0 auto; }
    @media (max-width: 700px) { .detail { grid-template-columns: 1fr; } }
  `);
});

app.get('/app.js', (req, res) => {
  res.type('js').send(`
    // Small enhancement: confirm before removing an item from the cart
    document.addEventListener('submit', (e) => {
      if (e.target.dataset.confirm && !confirm(e.target.dataset.confirm)) e.preventDefault();
    });
  `);
});

// ---------- Product pages ----------
app.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  const cards = products
    .map(
      (p) => `
      <div class="card">
        <img src="${esc(p.image)}" alt="${esc(p.name)}">
        <h3>${esc(p.name)}</h3>
        <p class="price">${money(p.price)}</p>
        <p>${p.stock > 0 ? 'In stock' : '<strong>Out of stock</strong>'}</p>
        <a class="btn" href="/products/${p.id}">View details</a>
      </div>`
    )
    .join('');
  layout(res, 'Products', `<h1>Products</h1><div class="grid">${cards}</div>`);
});

app.get('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).send('Product not found');
  layout(
    res,
    p.name,
    `<div class="panel detail">
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div>
        <h1>${esc(p.name)}</h1>
        <p class="price">${money(p.price)}</p>
        <p>${esc(p.description)}</p>
        <p>Stock: ${p.stock}</p>
        ${p.stock > 0
          ? `<form method="POST" action="/cart/add">
               <input type="hidden" name="id" value="${p.id}">
               <label>Quantity <input type="number" name="quantity" value="1" min="1" max="${p.stock}"></label>
               <button class="btn success" type="submit">Add to cart</button>
             </form>`
          : '<p><strong>Currently out of stock.</strong></p>'}
      </div>
    </div>`
  );
});

// ---------- Shopping cart ----------
app.post('/cart/add', (req, res) => {
  const id = Number(req.body.id);
  const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) return res.redirect('/');

  const current = req.session.cart[id] || 0;
  if (current + qty > p.stock) {
    return res.redirect(`/products/${id}?error=${encodeURIComponent('Not enough stock available')}`);
  }
  req.session.cart[id] = current + qty;
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  delete req.session.cart[req.body.id];
  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  const ids = Object.keys(req.session.cart);
  let total = 0;
  const rows = ids
    .map((id) => {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!p) return '';
      const qty = req.session.cart[id];
      const line = p.price * qty;
      total += line;
      return `<tr>
        <td>${esc(p.name)}</td>
        <td>${money(p.price)}</td>
        <td>${qty}</td>
        <td>${money(line)}</td>
        <td>
          <form method="POST" action="/cart/remove" class="inline" data-confirm="Remove this item?">
            <input type="hidden" name="id" value="${p.id}">
            <button class="btn danger" type="submit">Remove</button>
          </form>
        </td>
      </tr>`;
    })
    .join('');

  const error = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : '';
  const content = ids.length
    ? `<table>
         <tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>
         ${rows}
         <tr><th colspan="3">Total</th><th>${money(total)}</th><th></th></tr>
       </table>
       <p><a class="btn success" href="/checkout">Proceed to checkout</a></p>`
    : '<p>Your cart is empty. <a href="/">Continue shopping</a></p>';

  layout(res, 'Cart', `<div class="panel"><h1>Shopping Cart</h1>${error}${content}</div>`);
});

// ---------- Orders ----------
app.get('/checkout', requireLogin, (req, res) => {
  const ids = Object.keys(req.session.cart);
  if (!ids.length) return res.redirect('/cart');
  layout(
    res,
    'Checkout',
    `<div class="panel narrow">
       <h1>Checkout</h1>
       <p>You are ordering ${res.locals.cartCount} item(s) as <strong>${esc(res.locals.user.username)}</strong>.</p>
       <form method="POST" action="/checkout">
         <button class="btn success" type="submit">Place order</button>
       </form>
     </div>`
  );
});

app.post('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart;
  const ids = Object.keys(cart);
  if (!ids.length) return res.redirect('/cart');

  try {
    const orderId = db.transaction(() => {
      let total = 0;
      const lines = [];
      for (const id of ids) {
        const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!p) throw new Error('A product in your cart no longer exists.');
        if (p.stock < cart[id]) throw new Error(`Not enough stock for ${p.name}.`);
        total += p.price * cart[id];
        lines.push({ p, qty: cart[id] });
      }

      const { lastInsertRowid } = db
        .prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)')
        .run(req.session.userId, total);

      for (const { p, qty } of lines) {
        db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
          .run(lastInsertRowid, p.id, qty, p.price);
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, p.id);
      }
      return lastInsertRowid;
    })();

    req.session.cart = {};
    res.redirect(`/orders?placed=${orderId}`);
  } catch (err) {
    res.redirect(`/cart?error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/orders', requireLogin, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.session.userId);

  const notice = req.query.placed
    ? `<div class="success-msg">Order #${esc(req.query.placed)} placed successfully!</div>`
    : '';

  const blocks = orders
    .map((o) => {
      const items = db
        .prepare(`SELECT oi.quantity, oi.price, p.name FROM order_items oi
                  JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`)
        .all(o.id);
      const rows = items
        .map((i) => `<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${money(i.price)}</td></tr>`)
        .join('');
      return `<div class="panel" style="margin-bottom:16px">
        <h3>Order #${o.id} <small>(${esc(o.created_at)})</small></h3>
        <table>${rows}</table>
        <p><strong>Total: ${money(o.total)}</strong></p>
      </div>`;
    })
    .join('');

  layout(
    res,
    'My Orders',
    `<h1>My Orders</h1>${notice}${blocks || '<p>You have no orders yet.</p>'}`
  );
});

// ---------- Registration and login ----------
app.get('/register', (req, res) => {
  layout(res, 'Register', registerForm());
});

function registerForm(error = '') {
  return `<div class="panel narrow">
    <h1>Create an account</h1>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/register">
      <div class="form-group"><label>Username</label><input name="username" required></div>
      <div class="form-group"><label>Email</label><input name="email" type="email" required></div>
      <div class="form-group"><label>Password</label><input name="password" type="password" minlength="6" required></div>
      <button class="btn success" type="submit">Register</button>
    </form>
  </div>`;
}

app.post('/register', (req, res) => {
  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!username || !email || password.length < 6) {
    return layout(res, 'Register', registerForm('Please fill every field. Password must be at least 6 characters.'));
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (exists) {
    return layout(res, 'Register', registerForm('That username or email is already registered.'));
  }

  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
    .run(username, email, hash);

  req.session.userId = lastInsertRowid;
  res.redirect('/');
});

app.get('/login', (req, res) => {
  layout(res, 'Login', loginForm());
});

function loginForm(error = '') {
  return `<div class="panel narrow">
    <h1>Login</h1>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <form method="POST" action="/login">
      <div class="form-group"><label>Username</label><input name="username" required></div>
      <div class="form-group"><label>Password</label><input name="password" type="password" required></div>
      <button class="btn" type="submit">Login</button>
    </form>
    <p>No account? <a href="/register">Register here</a></p>
  </div>`;
}

app.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get((req.body.username || '').trim());
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password)) {
    return layout(res, 'Login', loginForm('Invalid username or password.'));
  }
  req.session.userId = user.id;
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Simple Shop running at http://localhost:${PORT}`);
});
