/**
 * Orbital Type - Interactive 3D Spinning Text Globe
 * Adapted for Ghani University Portals (Student, Teacher, Admin)
 * Text: GHANI UNIVERSITY SHEIKHUPURA •
 * Strictly forwards natural left-to-right English reading order
 * Colors: #1E3A8A, #3B82F6, #93C5FD, #FFFFFF
 */

(function () {
  'use strict';

  class OrbitalType {
    constructor(canvasId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.text = options.text || 'GHANI UNIVERSITY SHEIKHUPURA • ';
      this.radius = options.radius || 135;
      this.fontSize = options.fontSize || 12;
      this.centerEmblem = options.centerEmblem !== false;

      // 3D Rotation State
      this.yaw = 0.0;
      this.pitch = 0.25;
      this.yawSpeed = 0.005; // Smooth forward carousel glide
      this.pitchSpeed = 0.0005;

      // Mouse / Touch Interaction (Spin by hand)
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
      this.dampening = 0.94;

      // Configure Rings (All forward direction so text NEVER reads backwards/reversed)
      this.rings = [
        { inclination: 0.32, radiusRatio: 1.06, speedMult: 1.0, text: this.text },
        { inclination: -0.40, radiusRatio: 0.96, speedMult: 0.88, text: this.text },
        { inclination: 0.05, radiusRatio: 1.16, speedMult: 1.12, text: this.text },
        { inclination: 0.70, radiusRatio: 0.80, speedMult: 0.75, text: 'GHANI UNIVERSITY • SHEIKHUPURA • ' }
      ];

      this.setupCanvas();
      this.initEvents();
      this.animate();
    }

    setupCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width || 350;
      this.height = rect.height || 350;

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

        // Dragging right rotates globe right; dragging left rotates left
        this.yaw -= this.dragVelocityX;
        this.pitch += this.dragVelocityY;

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
      // Auto-adapt canvas dimensions to CSS bounding size
      const currentWidth = this.canvas.clientWidth;
      const currentHeight = this.canvas.clientHeight;
      if (currentWidth > 20 && (Math.abs(currentWidth - this.width) > 2 || Math.abs(currentHeight - this.height) > 2)) {
        this.setupCanvas();
      }

      this.ctx.clearRect(0, 0, this.width, this.height);

      // Inertia update
      if (!this.isDragging) {
        this.yaw += this.yawSpeed - this.dragVelocityX;
        this.pitch += this.pitchSpeed + this.dragVelocityY;
        this.dragVelocityX *= this.dampening;
        this.dragVelocityY *= this.dampening;
      }

      // Constrain vertical pitch
      this.pitch = Math.max(-1.0, Math.min(1.0, this.pitch));

      // Draw Center Glow Sphere
      const grad = this.ctx.createRadialGradient(
        this.centerX, this.centerY, 10,
        this.centerX, this.centerY, this.radius * 0.85
      );
      grad.addColorStop(0, 'rgba(59, 130, 246, 0.32)');
      grad.addColorStop(0.5, 'rgba(30, 58, 138, 0.20)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, this.centerY, this.radius * 0.85, 0, Math.PI * 2);
      this.ctx.fill();

      // Collect all 3D points
      const particles = [];
      const focalLength = 340;

      this.rings.forEach((ring, rIdx) => {
        const text = ring.text;
        const count = text.length;
        const ringRadius = this.radius * ring.radiusRatio;

        for (let i = 0; i < count; i++) {
          const char = text[i];
          // Natural left-to-right English reading order:
          // Character 0 at front center, Character 1 to its right (+X)
          const theta = (i / count) * Math.PI * 2 - (this.yaw * ring.speedMult);

          // Inclined ring coordinate math (sin = X, cos = Z)
          let x0 = ringRadius * Math.sin(theta);
          let y0 = -ringRadius * Math.cos(theta) * Math.sin(ring.inclination);
          let z0 = ringRadius * Math.cos(theta) * Math.cos(ring.inclination);

          // Apply Pitch (around X axis)
          const cosP = Math.cos(this.pitch);
          const sinP = Math.sin(this.pitch);
          const y1 = y0 * cosP - z0 * sinP;
          const z1 = y0 * sinP + z0 * cosP;

          // Perspective Projection
          const scale = focalLength / (focalLength + z1);
          const projX = this.centerX + x0 * scale;
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
        const isFront = p.z > -10;
        const depthNorm = Math.max(0, Math.min(1, (p.z + this.radius) / (this.radius * 2)));
        const alpha = Math.max(0.12, Math.min(1.0, 0.20 + depthNorm * 0.80));

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.font = `800 ${Math.round(this.fontSize * p.scale)}px "Inter", -apple-system, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (isFront) {
          // Front letters: Bright white & sky blue with luminous neon glow
          this.ctx.fillStyle = depthNorm > 0.65
            ? `rgba(255, 255, 255, ${alpha})`
            : `rgba(147, 197, 253, ${alpha})`;
          this.ctx.shadowColor = 'rgba(59, 130, 246, 0.85)';
          this.ctx.shadowBlur = 9 * p.scale;
        } else {
          // Rear letters: Subdued navy fading into background
          this.ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.35})`;
          this.ctx.shadowBlur = 0;
        }

        this.ctx.fillText(p.char, 0, 0);
        this.ctx.restore();
      });

      // Draw Center University Emblem in globe core
      if (this.centerEmblem) {
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '900 24px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.shadowColor = 'rgba(59, 130, 246, 0.9)';
        this.ctx.shadowBlur = 14;
        this.ctx.fillText('GU', this.centerX, this.centerY - 2);

        this.ctx.font = '700 9px "Inter", sans-serif';
        this.ctx.fillStyle = 'rgba(147, 197, 253, 0.85)';
        this.ctx.shadowBlur = 4;
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

  // Auto-initialize across Student, Teacher, and Admin portals
  function initAllOrbitalCanvases() {
    const ids = ['orbital-type-canvas', 'orbital-type-canvas-teacher', 'orbital-type-canvas-admin'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._orbitalInstance) {
        el._orbitalInstance = new OrbitalType(id, {
          text: 'GHANI UNIVERSITY SHEIKHUPURA • ',
          radius: 130,
          fontSize: 12
        });
      }
    });

    document.querySelectorAll('.orbital-type-canvas').forEach(el => {
      if (el && !el._orbitalInstance) {
        if (!el.id) el.id = 'orbital-canvas-' + Math.random().toString(36).substring(2, 9);
        el._orbitalInstance = new OrbitalType(el.id, {
          text: 'GHANI UNIVERSITY SHEIKHUPURA • ',
          radius: 130,
          fontSize: 12
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllOrbitalCanvases);
  } else {
    initAllOrbitalCanvases();
  }
})();