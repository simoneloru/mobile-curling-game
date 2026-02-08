class Game {
    constructor() {
        this.canvas = document.getElementById('curlingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Ice dimensions (simplified ratio)
        this.rinkWidth = 0;
        this.rinkHeight = 0;
        
        this.stones = [];
        this.currentTurn = 'player'; // 'player' or 'ai'
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }
    
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Setup rink dimensions to fit screen with padding
        // Portrait mode is preferred for curling
        this.rinkWidth = this.width * 0.9;
        this.rinkHeight = this.height * 0.95;
    }
    
    update() {
        // Physics update placeholder
    }
    
    draw() {
        // Clear screen
        this.ctx.fillStyle = '#e0f7fa'; // Light ice blue
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw Rink (simplified)
        this.ctx.save();
        this.ctx.translate(this.width/2, this.height/2);
        
        // Draw House (Target) - Top
        this.drawHouse(0, -this.rinkHeight/2 + this.rinkWidth/2);
        
        // Draw House (Start) - Bottom
        this.drawHouse(0, this.rinkHeight/2 - this.rinkWidth/2);

        // Draw Hog Lines
        this.ctx.strokeStyle = '#c62828'; // Red
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.rinkWidth/2, -this.rinkHeight/4);
        this.ctx.lineTo(this.rinkWidth/2, -this.rinkHeight/4);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(-this.rinkWidth/2, this.rinkHeight/4);
        this.ctx.lineTo(this.rinkWidth/2, this.rinkHeight/4);
        this.ctx.stroke();

        this.ctx.restore();
    }
    
    drawHouse(x, y) {
        const colors = ['#d32f2f', '#fff', '#1976d2', '#fff']; // Red, White, Blue, Button(White) centers
        const radii = [this.rinkWidth/2.5, this.rinkWidth/3.5, this.rinkWidth/5, this.rinkWidth/12];
        
        for (let i = 0; i < 4; i++) {
            this.ctx.fillStyle = colors[i];
            this.ctx.beginPath();
            this.ctx.arc(x, y, radii[i], 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }
}

// Start Game
window.onload = () => {
    const game = new Game();
};
