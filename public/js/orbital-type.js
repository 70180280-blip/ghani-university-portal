/**
 * Orbital Type - Interactive 3D Spinning Text Globe
 * Adapted for Ghani University Portal
 * Text: GHANI UNIVERSITY SHEIKHUPURA
 * Colors: #1E3A8A, #3B82F6, #93C5FD, #FFFFFF
 */

(function () {
  class OrbitalType {
    constructor(canvasId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.text = options.text || 'GHANI UNIVERSITY SHEIKHUPURA • ';
      this.radius = options.radius || 135;
      this.fontSize = options.fontSize || 13;
      this.centerEmblem = options.centerEmblem !== false;

      // 3D Rotation State
      this.yaw = 0.2;
      this.pitch = 0.35;
      this.yawSpeed = 0.006;
      this.pitchSpeed = 0.001;

      // Mouse / Touch Interaction (Spin by hand)
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
      this.dampening = 0.94;

      // Configure Rings
      this.rings = [
        { inclination: 0.35, radiusRatio: 1.08, speedMult: 1.0, direction: 1, text: this.text },
        { inclination: -0.45, radiusRatio: 0.95, speedMult: 0.85, direction: -1, text: this.text },
        { inclination: 0.0, radiusRatio: 1.18, speedMult: 1.15, direction: 1, text: this.text },
        { inclination: 0.75, radiusRatio: 0.75, speedMult: 0.7, direction: -1, text: 'GHANI UNIVERSITY • SHEIKHUPURA • ' }
      ];

      this.setupCanvas();
      this.initEvents();
      this.animate();
    }

    setupCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width || 360;
      this.height = rect.height || 360;

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.centerX = this.width / 2;
      this.centerY = this.height / 2;
    }

    initEvents() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const onStart = (e) => {
        this.isDragging = true;
        const pos = getPos(e);
        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.canvas.style.cursor = 'grabbing';
      };

      const onMove = (e) => {
        if (!this.isDragging) return;
        const pos = getPos(e);
        const dx = pos.x - this.lastMouseX;
        const dy = pos.y - this.lastMouseY;

        this.dragVelocityX = dx * 0.008;
        this.dragVelocityY = dy * 0.008;

        this.yaw += this.dragVelocityX;
        this.pitch -= this.dragVelocityY;

        this.lastMouseX = pos.x;
        this.lastMouseY = pos.y;
      };

      const onEnd = () => {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
      };

      this.canvas.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.canvas.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);

      window.addEventListener('resize', () => this.setupCanvas());
    }

    render() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      // Inertia update
      if (!this.isDragging) {
        this.yaw += this.yawSpeed + this.dragVelocityX;
        this.pitch += this.pitchSpeed - this.dragVelocityY;
        this.dragVelocityX *= this.dampening;
        this.dragVelocityY *= this.dampening;
      }

      // Constrain vertical pitch
      this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch));

      // Draw Center Glow Sphere
      const grad = this.ctx.createRadialGradient(
        this.centerX, this.centerY, 10,
        this.centerX, this.centerY, this.radius * 0.85
      );
      grad.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
      grad.addColorStop(0.5, 'rgba(30, 58, 138, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, this.centerY, this.radius * 0.85, 0, Math.PI * 2);
      this.ctx.fill();

      // Collect all 3D points
      const particles = [];
      const focalLength = 320;

      this.rings.forEach((ring, rIdx) => {
        const text = ring.text;
        const count = text.length;
        const ringRadius = this.radius * ring.radiusRatio;

        for (let i = 0; i < count; i++) {
          const char = text[i];
          const theta = (i / count) * Math.PI * 2 + (this.yaw * ring.speedMult * ring.direction);

          // Point on inclined circle
          let x = ringRadius * Math.cos(theta);
          let y = ringRadius * Math.sin(theta) * Math.sin(ring.inclination);
          let z = ringRadius * Math.sin(theta) * Math.cos(ring.inclination);

          // Apply Pitch (around X axis)
          const cosP = Math.cos(this.pitch);
          const sinP = Math.sin(this.pitch);
          const y1 = y * cosP - z * sinP;
          const z1 = y * sinP + z * cosP;

          // Apply Perspective
          const scale = focalLength / (focalLength + z1);
          const projX = this.centerX + x * scale;
          const projY = this.centerY + y1 * scale;

          particles.push({
            char,
            x: projX,
            y: projY,
            z: z1,
            scale,
            ringIndex: rIdx
          });
        }
      });

      // Sort by depth (back to front)
      particles.sort((a, b) => a.z - b.z);

      // Render depth-sorted characters
      particles.forEach((p) => {
        const isFront = p.z > 0;
        const depthNorm = (p.z + this.radius) / (this.radius * 2); // 0 (far) to 1 (near)
        const alpha = Math.max(0.18, Math.min(1.0, 0.25 + depthNorm * 0.75));

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.font = `800 ${Math.round(this.fontSize * p.scale)}px "Inter", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (isFront) {
          // Front letters: Bright soft sky / pure white
          this.ctx.fillStyle = depthNorm > 0.7
            ? `rgba(255, 255, 255, ${alpha})`
            : `rgba(147, 197, 253, ${alpha})`;
          this.ctx.shadowColor = 'rgba(59, 130, 246, 0.7)';
          this.ctx.shadowBlur = 8 * p.scale;
        } else {
          // Rear letters: Deep navy / blue fading into background
          this.ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.55})`;
          this.ctx.shadowBlur = 0;
        }

        this.ctx.fillText(p.char, 0, 0);
        this.ctx.restore();
      });

      // Draw Center Emblem in center
      if (this.centerEmblem) {
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '900 24px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.8)';
        this.ctx.shadowBlur = 12;
        this.ctx.fillText('GU', this.centerX, this.centerY - 2);
        this.ctx.font = '700 9px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(147, 197, 253, 0.8)';
        this.ctx.fillText('EST. 2026', this.centerX, this.centerY + 16);
        this.ctx.restore();
      }
    }

    animate() {
      this.render();
      requestAnimationFrame(() => this.animate());
    }
  }

  window.OrbitalType = OrbitalType;

  // Auto-initialize when DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('orbital-type-canvas')) {
      new OrbitalType('orbital-type-canvas', {
        text: 'GHANI UNIVERSITY SHEIKHUPURA • ',
        radius: 130,
        fontSize: 12
      });
    }
  });
})();
