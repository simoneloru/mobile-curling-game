// Physics Constants
const FRICTION_NORMAL = 0.992;
const FRICTION_SWEEPING = 0.998;
const STONE_RADIUS_RATIO = 0.04;
const STONE_MASS = 20;

// Game State Constants
const STATE = {
    IDLE: 0,
    AIMING: 1,
    MOVING: 2,
    END_FINISHED: 3
};

class Stone {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color; // Expecting hex code
        this.vx = 0;
        this.vy = 0;
        this.isMoving = false;
        this.mass = STONE_MASS;
    }

    update() {
        if (!this.isMoving) return;

        this.x += this.vx;
        this.y += this.vy;

        // Apply Friction
        const currentFriction = (window.gameInstance && window.gameInstance.isSweeping) ? FRICTION_SWEEPING : FRICTION_NORMAL;
        this.vx *= currentFriction;
        this.vy *= currentFriction;

        // Stop if too slow
        if (Math.abs(this.vx) < 0.05 && Math.abs(this.vy) < 0.05) {
            this.vx = 0;
            this.vy = 0;
            this.isMoving = false;
        }
    }

    draw(ctx) {
        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        // Main Body Gradient (3D effect)
        let gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, this.lightenColor(this.color, 40));
        gradient.addColorStop(0.4, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 20));

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Reset Shadow for handle
        ctx.shadowColor = 'transparent';

        // Stone Border (Granite look)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Handle (Inner Circle)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#eee'; // Handle base
        ctx.fill();
        ctx.strokeStyle = '#ccc';
        ctx.stroke();

        // Handle Color Indicator (Small dot)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // Helper to adjust color brightness for 3D effect
    lightenColor(col, amt) { return this.adjustColor(col, amt); }
    darkenColor(col, amt) { return this.adjustColor(col, -amt); }

    adjustColor(col, amt) {
        let usePound = false;
        if (col[0] == "#") {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('curlingCanvas');
        this.ctx = this.canvas.getContext('2d');

        // DOM Elements for HUD
        this.p1ScoreEl = document.getElementById('p1-score');
        this.p2ScoreEl = document.getElementById('p2-score');
        this.turnEl = document.getElementById('turn-text');
        this.notifyEl = document.getElementById('notification-area');
        this.stonesEl = document.getElementById('stones-remaining-p1');

        this.stones = [];
        this.playerStones = [];
        this.aiStones = [];

        this.turnState = 'PLAYER'; // 'PLAYER' or 'AI'
        this.gameState = STATE.IDLE;

        this.isDragging = false;
        this.isSweeping = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        window.gameInstance = this;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousedown', this.handleInputStart.bind(this));
        this.canvas.addEventListener('touchstart', this.handleInputStart.bind(this), { passive: false });
        this.canvas.addEventListener('mousemove', this.handleInputMove.bind(this));
        this.canvas.addEventListener('touchmove', this.handleInputMove.bind(this), { passive: false });
        this.canvas.addEventListener('mouseup', this.handleInputEnd.bind(this));
        this.canvas.addEventListener('touchend', this.handleInputEnd.bind(this));

        this.startNewEnd();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }


    resize() {
        const container = document.getElementById('game-container');
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Mobile Safe Areas
        const topUIHeight = 60; // Matches CSS
        const bottomUIHeight = 100; // Matches CSS + margin

        this.playableTop = topUIHeight;
        this.playableHeight = this.height - topUIHeight - bottomUIHeight;

        this.centerX = this.width / 2;
        this.buttonY = this.playableTop + (this.playableHeight * 0.25);
        this.hackY = this.height - bottomUIHeight - (this.playableHeight * 0.1);

        this.rinkWidth = this.width;
    }

    startNewEnd() {
        this.stones = [];
        this.playerStones = Array(4).fill(0);
        this.aiStones = Array(4).fill(0);
        this.turnState = 'PLAYER';
        this.gameState = STATE.IDLE;

        this.resize();
        this.updateHUD();
        this.prepareTurn();
    }

    updateHUD() {
        this.turnEl.textContent = this.turnState === 'PLAYER' ? "YOUR TURN" : "AI THINKING...";
        this.turnEl.style.color = this.turnState === 'PLAYER' ? '#d32f2f' : '#fbc02d';

        // Stone indicators could be better, but text is fine for now
        this.p1ScoreEl.textContent = this.playerScore || 0;
        this.p2ScoreEl.textContent = this.aiScore || 0;
    }

    prepareTurn() {
        if (this.playerStones.length === 0 && this.aiStones.length === 0) {
            this.gameState = STATE.END_FINISHED;
            this.calculateScore();
            return;
        }

        this.gameState = STATE.IDLE;

        const radius = this.width * 0.045; // Slightly larger for better visibility
        const color = this.turnState === 'PLAYER' ? '#d32f2f' : '#fdd835';

        this.currentStone = new Stone(this.centerX, this.hackY, radius, color);

        this.updateHUD();

        if (this.turnState === 'AI') {
            setTimeout(() => this.executeAITurn(), 1000);
        }
    }

    calculateScore() {
        // Find closest stone to button center
        let closestDist = Infinity;
        let winner = null;
        let points = 0;

        // Filter stones in house (approximate radius check)
        const houseRadius = this.width * 0.35;

        const validStones = this.stones.filter(s => {
            const dist = Math.hypot(s.x - this.centerX, s.y - this.buttonY);
            return dist < houseRadius + s.radius;
        });

        // Sort by distance
        validStones.sort((a, b) => {
            const distA = Math.hypot(a.x - this.centerX, a.y - this.buttonY);
            const distB = Math.hypot(b.x - this.centerX, b.y - this.buttonY);
            return distA - distB;
        });

        if (validStones.length > 0) {
            const bestStone = validStones[0];
            winner = bestStone.color === '#d32f2f' ? 'PLAYER' : 'AI';

            // Count consecutive stones
            for (let s of validStones) {
                const sOwner = s.color === '#d32f2f' ? 'PLAYER' : 'AI';
                if (sOwner === winner) {
                    points++;
                } else {
                    break;
                }
            }
        }

        // Update Total Score
        if (!this.playerScore) this.playerScore = 0;
        if (!this.aiScore) this.aiScore = 0;

        let message = "No Score!";
        if (winner === 'PLAYER') {
            this.playerScore += points;
            message = `YOU SCORE ${points} POINTS!`;
        } else if (winner === 'AI') {
            this.aiScore += points;
            message = `AI SCORES ${points} POINTS!`;
        }

        this.updateHUD();

        setTimeout(() => {
            alert(`${message}\n\nStart Next End?`);
            this.startNewEnd();
        }, 500);
    }

    executeAITurn() {
        if (this.turnState !== 'AI') return;

        const targetX = this.centerX;
        const targetY = this.buttonY;

        const errorX = (Math.random() - 0.5) * (this.width * 0.15);
        const distY = this.hackY - targetY;

        // Physics calibration for resize
        const forceY = -distY * 0.150;
        const forceX = (targetX + errorX - this.centerX) * 0.05;

        this.currentStone.vx = forceX;
        this.currentStone.vy = forceY;
        this.currentStone.isMoving = true;

        this.stones.push(this.currentStone);
        this.aiStones.pop();
        this.gameState = STATE.MOVING;
    }

    handleInputStart(e) {
        if (this.turnState !== 'PLAYER' || this.gameState !== STATE.IDLE) return;
        e.preventDefault();

        // Detect Input Type
        this.inputType = (e.touches) ? 'touch' : 'mouse';

        const pos = this.getEventPos(e);

        const hitArea = this.currentStone.radius * 3.0;
        const dx = pos.x - this.currentStone.x;
        const dy = pos.y - this.currentStone.y;

        if (Math.hypot(dx, dy) < hitArea) {
            this.isDragging = true;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;

            // Show Power Bar
            document.getElementById('power-bar-container').style.display = 'block';
        }
    }

    handleInputMove(e) {
        e.preventDefault();
        const pos = this.getEventPos(e);
        this.currentInputPos = pos;

        if (this.gameState === STATE.MOVING) {
            const anyMoving = this.stones.some(s => s.isMoving);
            if (anyMoving) {
                this.isSweeping = true;
                this.triggerSweepVisual(pos);
                clearTimeout(this.sweepTimeout);
                this.sweepTimeout = setTimeout(() => { this.isSweeping = false; }, 100);
            }
            return;
        }

        if (this.isDragging) {
            // Update Power Bar
            const dx = this.currentStone.x - pos.x; // Drag Back logic
            const dy = this.currentStone.y - pos.y;
            const dist = Math.hypot(dx, dy);

            const maxPull = this.height * 0.25; // Max pull distance relative to screen height
            const powerPercent = Math.min(dist / maxPull, 1) * 100;

            document.getElementById('power-bar-fill').style.height = `${powerPercent}%`;
        }
    }

    triggerSweepVisual(pos) {
        // Placeholder
    }

    handleInputEnd(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        // Hide Power Bar
        document.getElementById('power-bar-container').style.display = 'none';
        document.getElementById('power-bar-fill').style.height = '0%';

        const pos = this.getEventPos(e);
        // On touch end, we might not have pos, use last known input pos if needed, 
        // but for drag calculation we used start vs end. 
        // Better to use current input pos tracked during move? 
        // Actually drag is diff between start and current. 
        // Let's use the last tracked position from move if available, or event pos.

        // Simpler: Just rely on dragStartX - currentPos (if we tracked it) or event pos. 
        // Touchend changedTouches usually works.
        const dragEndX = pos.x;
        const dragEndY = pos.y;

        const throwX = this.dragStartX - dragEndX;
        const throwY = this.dragStartY - dragEndY;

        // Input Tuning
        let forceMultiplier = 0.15; // Base
        if (this.inputType === 'mouse') forceMultiplier = 0.12; // Lower for mouse (precision)
        if (this.inputType === 'touch') forceMultiplier = 0.18; // Higher for touch (responsiveness)

        const MAX_SPEED = 25; // Speed Clamp

        if (Math.hypot(throwX, throwY) > 20) {
            let vx = throwX * forceMultiplier;
            let vy = throwY * forceMultiplier;

            // Clamp Speed
            const speed = Math.hypot(vx, vy);
            if (speed > MAX_SPEED) {
                const scale = MAX_SPEED / speed;
                vx *= scale;
                vy *= scale;
            }

            this.currentStone.vx = vx;
            this.currentStone.vy = vy;
            this.currentStone.isMoving = true;

            this.stones.push(this.currentStone);
            this.playerStones.pop();
            this.gameState = STATE.MOVING;
        }

        this.isDragging = false;
        this.updateHUD();
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    update() {
        if (this.gameState === STATE.MOVING) {
            let anyMoving = false;
            this.stones.forEach(stone => {
                stone.update();
                if (stone.isMoving) anyMoving = true;

                // Boundaries (Bounce off sides)
                if (stone.x - stone.radius < 0) { stone.x = stone.radius; stone.vx *= -0.5; }
                if (stone.x + stone.radius > this.width) { stone.x = this.width - stone.radius; stone.vx *= -0.5; }

                // Back/Front walls
                if (stone.y - stone.radius < 0) { stone.y = stone.radius; stone.vy *= -0.5; }
                if (stone.y + stone.radius > this.height) { stone.y = this.height - stone.radius; stone.vy *= -0.5; }
            });

            // Collisions
            for (let i = 0; i < this.stones.length; i++) {
                for (let j = i + 1; j < this.stones.length; j++) {
                    this.checkCollision(this.stones[i], this.stones[j]);
                }
            }

            if (!anyMoving && this.stones.length > 0) {
                this.turnState = this.turnState === 'PLAYER' ? 'AI' : 'PLAYER';
                this.prepareTurn();
            }
        }
    }

    checkCollision(s1, s2) {
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const distance = Math.hypot(dx, dy);

        if (distance < s1.radius + s2.radius) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const v1 = { x: s1.vx * cos + s1.vy * sin, y: s1.vy * cos - s1.vx * sin };
            const v2 = { x: s2.vx * cos + s2.vy * sin, y: s2.vy * cos - s2.vx * sin };

            const v1Final = { x: v2.x, y: v1.y };
            const v2Final = { x: v1.x, y: v2.y };

            s1.vx = v1Final.x * cos - v1Final.y * sin;
            s1.vy = v1Final.y * cos + v1Final.x * sin;
            s2.vx = v2Final.x * cos - v2Final.y * sin;
            s2.vy = v2Final.y * cos + v2Final.x * sin;

            // Inelastic restitution (stones lose energy on hit)
            const restitution = 0.8;
            s1.vx *= restitution; s1.vy *= restitution;
            s2.vx *= restitution; s2.vy *= restitution;

            s1.isMoving = true;
            s2.isMoving = true;

            const overlap = (s1.radius + s2.radius - distance) / 2;
            s1.x -= overlap * Math.cos(angle);
            s1.y -= overlap * Math.sin(angle);
            s2.x += overlap * Math.cos(angle);
            s2.y += overlap * Math.sin(angle);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw House
        this.drawHouse(this.centerX, this.buttonY);

        // Draw Hog Lines (Visual reference)
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.buttonY + this.width * 0.6); // Front Hog Line approx
        this.ctx.lineTo(this.width, this.buttonY + this.width * 0.6);
        this.ctx.strokeStyle = 'rgba(200, 0, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.stones.forEach(stone => stone.draw(this.ctx));

        if (this.gameState === STATE.IDLE && this.currentStone) {
            this.currentStone.draw(this.ctx);

            // Draw "Touch Area" debug (optional, helpful for understanding grab size)
            // this.ctx.beginPath();
            // this.ctx.arc(this.currentStone.x, this.currentStone.y, this.currentStone.radius * 2.5, 0, Math.PI*2);
            // this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            // this.ctx.stroke();
        }

        if (this.isDragging && this.turnState === 'PLAYER') {
            // this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            // this.ctx.stroke();
        }

        if (this.isDragging && this.turnState === 'PLAYER') {
            const dx = this.currentStone.x - this.dragStartX; // Vector from Start to Current (negative of pull)
            const dy = this.currentStone.y - this.dragStartY;

            // Invert for aiming (Pull back -> Shoot forward)
            // But dragStartX is where we clicked (on stone), current is where we dragged to.
            // If I drag down, y increases. dy is positive. 
            // I want to shoot up. So aim vector is (startX - currentX, startY - currentY)
            // Which is exactly (dx, dy) as defined above? No.
            // dx = currentStone.x (constant) - dragStartX (constant). Wait.
            // In handleInputMove: currentInputPos is updating. 
            // But here I'm using dragStartX. 
            // AND I AM NOT UPDATING currentStone.x in drag (it stays at hack). 
            // So I need (currentStone.x - currentInputPos.x) for the vector.

            // Let's use the currentInputPos if available, or just calculate from logic
            let aimX = 0, aimY = 0;
            if (this.currentInputPos) {
                aimX = this.currentStone.x - this.currentInputPos.x;
                aimY = this.currentStone.y - this.currentInputPos.y;
            }

            // Calculate Power for Color
            const pullDist = Math.hypot(aimX, aimY);
            const maxPull = this.height * 0.25;
            const powerRatio = Math.min(pullDist / maxPull, 1.0);

            let arrowColor = '#4caf50'; // Green
            if (powerRatio > 0.4) arrowColor = '#ffeb3b'; // Yellow
            if (powerRatio > 0.75) arrowColor = '#f44336'; // Red

            // Draw Aim Line
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentStone.x, this.currentStone.y);
            this.ctx.lineTo(this.currentStone.x + aimX * 3, this.currentStone.y + aimY * 3);
            this.ctx.setLineDash([15, 10]);
            this.ctx.strokeStyle = arrowColor;
            this.ctx.lineWidth = 4 + (powerRatio * 4); // Thicker with power
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Draw Pull Line (Visualizing the specific drag)
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentStone.x, this.currentStone.y);
            this.ctx.lineTo(this.currentStone.x - aimX, this.currentStone.y - aimY);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        if (this.isSweeping && this.currentInputPos) {
            this.ctx.beginPath();
            this.ctx.arc(this.currentInputPos.x, this.currentInputPos.y, 15, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
            this.notifyEl.innerHTML = "<div class='notification-anim'>SWEEPING!</div>";
        } else {
            this.notifyEl.innerHTML = "";
        }
    }

    drawHouse(x, y) {
        // Scaled down house
        const houseRadius = this.width * 0.35;
        const colors = ['#d32f2f', '#fff', '#1976d2', '#fff'];
        const radii = [1, 0.66, 0.33, 0.1].map(r => r * houseRadius);

        for (let i = 0; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, radii[i], 0, Math.PI * 2);
            this.ctx.fillStyle = colors[i];
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            this.ctx.stroke();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }
}

window.onload = () => {
    const game = new Game();
};
