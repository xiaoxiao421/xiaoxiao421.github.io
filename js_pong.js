// Simple Pong game
(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Resolution
  const W = canvas.width;
  const H = canvas.height;

  // Paddles
  const paddleWidth = 12;
  const paddleHeight = 100;
  const paddleMargin = 12;

  const leftPaddle = {
    x: paddleMargin,
    y: (H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    speed: 6,
    dy: 0
  };

  const rightPaddle = {
    x: W - paddleMargin - paddleWidth,
    y: (H - paddleHeight) / 2,
    w: paddleWidth,
    h: paddleHeight,
    speed: 4.2 // AI max speed
  };

  // Ball
  let ball = resetBall(true);

  function resetBall(toRight) {
    const initialSpeed = 5;
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // -22.5deg .. 22.5deg
    const dir = toRight ? 1 : -1;
    return {
      x: W / 2,
      y: H / 2,
      r: 8,
      speed: initialSpeed,
      vx: dir * initialSpeed * Math.cos(angle),
      vy: initialSpeed * Math.sin(angle)
    };
  }

  // Scores
  let leftScore = 0;
  let rightScore = 0;
  const targetScore = 10;

  // Game state
  let running = true;
  let paused = false;

  // DOM elements
  const leftScoreEl = document.getElementById("leftScore");
  const rightScoreEl = document.getElementById("rightScore");
  const restartBtn = document.getElementById("restartBtn");
  const pauseBtn = document.getElementById("pauseBtn");

  // Input: keyboard
  const keys = { ArrowUp: false, ArrowDown: false };
  window.addEventListener("keydown", e => {
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
      keys[e.code] = true;
      e.preventDefault();
    }
    if (e.code === "Space") {
      togglePause();
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", e => {
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
      keys[e.code] = false;
      e.preventDefault();
    }
  });

  // Input: mouse over canvas
  canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const mouseY = (e.clientY - rect.top) * scaleY;
    // center paddle on mouse y
    leftPaddle.y = clamp(mouseY - leftPaddle.h / 2, 0, H - leftPaddle.h);
  });

  // Buttons
  restartBtn.addEventListener("click", () => {
    leftScore = 0; rightScore = 0;
    updateScoreboard();
    ball = resetBall(Math.random() < 0.5);
    running = true;
    paused = false;
  });
  pauseBtn.addEventListener("click", togglePause);
  function togglePause() {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  // Helpers
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function updateScoreboard() {
    leftScoreEl.textContent = leftScore;
    rightScoreEl.textContent = rightScore;
  }

  // Collision detection between ball and rectangle paddle
  function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    // find closest point to circle within the rectangle
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= r * r;
  }

  // Game loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;
    if (!paused && running) update(dt / 16.6667); // normalize to ~60fps ticks
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(ticks) {
    // Keyboard movement for left paddle (adds to mouse control)
    const kbSpeed = leftPaddle.speed * ticks;
    if (keys.ArrowUp) leftPaddle.y -= kbSpeed;
    if (keys.ArrowDown) leftPaddle.y += kbSpeed;
    leftPaddle.y = clamp(leftPaddle.y, 0, H - leftPaddle.h);

    // Move ball
    ball.x += ball.vx * ticks;
    ball.y += ball.vy * ticks;

    // Wall collisions (top & bottom)
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
    } else if (ball.y + ball.r >= H) {
      ball.y = H - ball.r;
      ball.vy = -ball.vy;
    }

    // Left and right scoring
    if (ball.x + ball.r < 0) {
      // right player scores
      rightScore++;
      updateScoreboard();
      if (rightScore >= targetScore) {
        running = false;
        showWin("Computer");
      } else {
        ball = resetBall(true);
      }
      return;
    } else if (ball.x - ball.r > W) {
      // left player scores
      leftScore++;
      updateScoreboard();
      if (leftScore >= targetScore) {
        running = false;
        showWin("You");
      } else {
        ball = resetBall(false);
      }
      return;
    }

    // Paddle collisions
    // Left paddle
    if (circleRectCollision(ball.x, ball.y, ball.r, leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h)) {
      // place ball outside paddle
      ball.x = leftPaddle.x + leftPaddle.w + ball.r;
      reflectFromPaddle(leftPaddle);
    }

    // Right paddle
    if (circleRectCollision(ball.x, ball.y, ball.r, rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h)) {
      ball.x = rightPaddle.x - ball.r;
      reflectFromPaddle(rightPaddle, true);
    }

    // Simple AI for right paddle: follow ball's y with some max speed
    const centerBallY = ball.y;
    const centerR = rightPaddle.y + rightPaddle.h / 2;
    const diff = centerBallY - centerR;
    const maxMove = rightPaddle.speed * ticks;
    if (Math.abs(diff) > 2) {
      rightPaddle.y += clamp(diff, -maxMove, maxMove);
      rightPaddle.y = clamp(rightPaddle.y, 0, H - rightPaddle.h);
    }
  }

  function reflectFromPaddle(paddle, isRight = false) {
    // calculate hit position relative to paddle center (-1 .. 1)
    const relativeIntersectY = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
    const maxBounceAngle = (5 * Math.PI) / 12; // about 75 degrees
    const bounceAngle = relativeIntersectY * maxBounceAngle;
    const speedIncrease = 0.25; // slightly increase ball speed on hit

    const dir = isRight ? -1 : 1;
    const newSpeed = Math.min(ball.speed + speedIncrease, 14);
    ball.speed = newSpeed;
    ball.vx = dir * newSpeed * Math.cos(bounceAngle);
    ball.vy = newSpeed * Math.sin(bounceAngle);
  }

  function showWin(winner) {
    // simple alert, but also pause ball
    paused = true;
    setTimeout(() => {
      alert(`${winner} wins!`);
    }, 20);
  }

  // Drawing
  function draw() {
    // Clear
    ctx.clearRect(0, 0, W, H);

    // Middle dashed line
    ctx.strokeStyle = "rgba(205,230,255,0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    drawRect(leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h, "#98e6ff");
    drawRect(rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h, "#ffd480");

    // Ball
    drawCircle(ball.x, ball.y, ball.r, "#fff");

    // Scores are updated in DOM, but we can add small text overlays if desired
    // Optional: small pause overlay
    if (paused && running) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W / 2 - 140, H / 2 - 36, 280, 72);
      ctx.fillStyle = "#fff";
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Paused", W / 2, H / 2 + 6);
    }
  }

  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Initialization update scoreboard
  updateScoreboard();
})();