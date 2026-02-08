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
        this.color = color;
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
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('curlingCanvas');
        this.ctx = this.canvas.getContext('2d');

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
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.rinkWidth = this.width;
        this.rinkHeight = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.hackY = this.height - 100;
        this.buttonY = this.height / 4;
    }

    startNewEnd() {
        this.stones = [];
        this.playerStones = Array(4).fill(0);
        this.aiStones = Array(4).fill(0);
        this.turnState = 'PLAYER';
        this.gameState = STATE.IDLE;
        this.prepareTurn();
    }

    prepareTurn() {
        if (this.playerStones.length === 0 && this.aiStones.length === 0) {
            this.gameState = STATE.END_FINISHED;
            // Simple alert for now
            setTimeout(() => {
                alert("End Finished! Reload to play again (Scoring coming soon)");
                this.startNewEnd();
            }, 1000);
            return;
        }

        this.gameState = STATE.IDLE;

        const radius = this.width * STONE_RADIUS_RATIO;
        const color = this.turnState === 'PLAYER' ? '#d32f2f' : '#fdd835';

        this.currentStone = new Stone(this.centerX, this.hackY, radius, color);

        if (this.turnState === 'AI') {
            setTimeout(() => this.executeAITurn(), 1000);
        }
    }

    executeAITurn() {
        if (this.turnState !== 'AI') return;

        // Simple AI: Aim for button
        const targetX = this.centerX;
        const targetY = this.buttonY;

        const errorX = (Math.random() - 0.5) * (this.width * 0.1);
        const forceY = -(this.hackY - targetY) * 0.155;
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
        const pos = this.getEventPos(e);

        const dx = pos.x - this.currentStone.x;
        const dy = pos.y - this.currentStone.y;

        if (Math.hypot(dx, dy) < this.currentStone.radius * 2) {
            this.isDragging = true;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
        }
    }

    handleInputMove(e) {
        e.preventDefault();

        if (this.gameState === STATE.MOVING) {
            const anyMoving = this.stones.some(s => s.isMoving);
            if (anyMoving) {
                this.isSweeping = true;
                clearTimeout(this.sweepTimeout);
                this.sweepTimeout = setTimeout(() => { this.isSweeping = false; }, 100);
            }
            return;
        }

        if (!this.isDragging) return;
    }

    handleInputEnd(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const pos = this.getEventPos(e);
        const dragEndX = pos.x;
        const dragEndY = pos.y;

        const throwX = this.dragStartX - dragEndX;
        const throwY = this.dragStartY - dragEndY;

        const forceMultiplier = 0.15;

        if (Math.hypot(throwX, throwY) > 10) {
            this.currentStone.vx = throwX * forceMultiplier;
            this.currentStone.vy = throwY * forceMultiplier;
            this.currentStone.isMoving = true;

            this.stones.push(this.currentStone);
            this.playerStones.pop();
            this.gameState = STATE.MOVING;
        }

        this.isDragging = false;
    }

    getEventPos(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    update() {
        if (this.gameState === STATE.MOVING) {
            let anyMoving = false;
            this.stones.forEach(stone => {
                stone.update();
                if (stone.isMoving) anyMoving = true;
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

        if (this.gameState === STATE.IDLE && this.currentStone) {
            this.currentStone.x = this.centerX;
            this.currentStone.y = this.hackY;
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
        this.ctx.fillStyle = '#e0f7fa';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.drawHouse(this.centerX, this.buttonY);

        // Stones on ice
        this.stones.forEach(stone => stone.draw(this.ctx));

        if (this.gameState === STATE.IDLE && this.currentStone) {
            this.currentStone.draw(this.ctx);
        }

        if (this.isDragging && this.turnState === 'PLAYER') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentStone.x, this.currentStone.y);
            this.ctx.lineTo(this.currentStone.x + (this.currentStone.x - this.dragStartX), this.currentStone.y + (this.currentStone.y - this.dragStartY));
            this.ctx.strokeStyle = 'rgba(255,0,0,0.5)';
            this.ctx.lineWidth = 4;
            this.ctx.stroke();
        }

        if (this.isSweeping) {
            this.ctx.font = "bold 30px Arial";
            this.ctx.fillStyle = "orange";
            this.ctx.textAlign = "center";
            this.ctx.fillText("SWEEPING!", this.centerX, this.height * 0.3);
        }

        this.ctx.font = "20px Arial";
        this.ctx.fillStyle = "#333";
        this.ctx.textAlign = "left";
        this.ctx.fillText(`Turn: ${this.turnState === 'PLAYER' ? 'YOU (Red)' : 'AI (Yellow)'}`, 20, 40);
        this.ctx.fillText(`Stones: ${this.playerStones.length} - ${this.aiStones.length}`, 20, 70);
    }

    drawHouse(x, y) {
        const houseRadius = this.width * 0.4;
        const colors = ['#d32f2f', '#fff', '#1976d2', '#fff'];
        const radii = [1, 0.66, 0.33, 0.1].map(r => r * houseRadius);

        for (let i = 0; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, radii[i], 0, Math.PI * 2);
            this.ctx.fillStyle = colors[i];
            this.ctx.fill();
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
