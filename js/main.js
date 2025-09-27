document.addEventListener('DOMContentLoaded', () => {
    // --- Preloader ---
    const preloader = document.getElementById('preloader');
    window.addEventListener('load', () => {
        preloader.classList.add('opacity-0');
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500); // Match duration of the transition
    });

    // --- Interactive 3D Background ---
    let isAnimationRunning = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-canvas'), alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Black Hole Sphere
    const blackHoleGeometry = new THREE.SphereGeometry(0.7, 64, 64);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    scene.add(blackHole);

    // --- Accretion Disk Shader ---
    const diskShaderMaterial = new THREE.ShaderMaterial({
        uniforms: { time: { value: 1.0 } },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2 vUv;

            vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
            float snoise(vec2 v) {
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i = floor(v + dot(v, C.yy));
                vec2 x0 = v - i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
                m = m * m; m = m * m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x = a0.x * x0.x + h.x * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }

            void main() {
                float radius = length(vUv - 0.5);
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                float noise = snoise(vec2(angle * 5.0, radius * 8.0 + time * 0.5));
                float distortedAngle = angle + noise * 0.1;
                float doppler = 0.5 + 0.5 * cos(distortedAngle - time * 2.0);
                doppler = pow(doppler, 3.0);
                vec3 color1 = vec3(0.8, 0.9, 1.0); // Light blueish white
                vec3 color2 = vec3(0.1, 0.5, 1.0); // Deep blue
                vec3 finalColor = mix(color1, color2, 1.0 - doppler);
                float intensity = pow(1.0 - abs(radius - 0.25) * 4.0, 2.0);
                finalColor *= intensity;
                float alpha = 1.0 - smoothstep(0.49, 0.5, radius);
                alpha *= smoothstep(0.0, 0.02, radius);
                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });

    // Main horizontal disk
    const diskGeometry = new THREE.RingGeometry(0.8, 2.5, 128);
    const accretionDisk = new THREE.Mesh(diskGeometry, diskShaderMaterial);
    accretionDisk.rotation.x = -Math.PI / 2;
    scene.add(accretionDisk);

    // Inner Photon Ring
    const photonRingGeometry = new THREE.TorusGeometry(0.75, 0.02, 32, 128);
    const photonRingMaterial = new THREE.MeshBasicMaterial({ color: 0xa7e3ff, blending: THREE.AdditiveBlending });
    const photonRing = new THREE.Mesh(photonRingGeometry, photonRingMaterial);
    photonRing.rotation.x = Math.PI / 2;
    scene.add(photonRing);

    // Disk particles
    const diskParticleCount = 8000;
    const diskParticlesGeometry = new THREE.BufferGeometry();
    const diskPositions = new Float32Array(diskParticleCount * 3);
    const diskParticleData = [];

    for (let i = 0; i < diskParticleCount; i++) {
        let i3 = i * 3;
        let radius = 0.8 + Math.random() * 1.7;
        let angle = Math.random() * Math.PI * 2;
        diskPositions[i3] = Math.cos(angle) * radius;
        diskPositions[i3+1] = (Math.random() - 0.5) * 0.05;
        diskPositions[i3+2] = Math.sin(angle) * radius;
        diskParticleData.push({
            radius: radius,
            angle: angle,
            speed: (0.05 + Math.random() * 0.1) / radius
        });
    }
    diskParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(diskPositions, 3));
    const diskParticleMaterial = new THREE.PointsMaterial({
        size: 0.01,
        color: 0x38bdf8, // sky-400
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.7
    });
    const diskParticles = new THREE.Points(diskParticlesGeometry, diskParticleMaterial);
    scene.add(diskParticles);


    // Background Starfield
    const particles = 15000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particles * 3);
    const starData = [];

    for(let i=0; i<particles; i++){
        let i3 = i * 3;
        let radius = Math.random() * 20 + 5;
        let angle = Math.random() * Math.PI * 2;

        positions[i3] = Math.cos(angle) * radius;
        positions[i3+1] = (Math.random() - 0.5) * 4.0;
        positions[i3+2] = Math.sin(angle) * radius;

        starData.push({
            radius: radius,
            angle: angle,
            speed: (Math.random() * 0.002 + 0.001) / radius,
            baseY: positions[i3+1]
        });
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        size: 0.015,
        color: 0xe0f2fe, // sky-100
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    const starfield = new THREE.Points(geometry, material);
    scene.add(starfield);

    camera.position.set(0, 3.5, 9);
    camera.lookAt(scene.position);

    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    const clock = new THREE.Clock();
    let animationFrameId;

    function animate() {
        if (!isAnimationRunning) {
            cancelAnimationFrame(animationFrameId);
            return;
        }
        animationFrameId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        diskShaderMaterial.uniforms.time.value = elapsedTime;

        // Animate disk particles
        const diskPosArray = diskParticles.geometry.attributes.position.array;
        for (let i = 0; i < diskParticleCount; i++) {
            let i3 = i * 3;
            let data = diskParticleData[i];
            data.angle += data.speed * delta * 25;
            diskPosArray[i3] = Math.cos(data.angle) * data.radius;
            diskPosArray[i3+2] = Math.sin(data.angle) * data.radius;
        }
        diskParticles.geometry.attributes.position.needsUpdate = true;


        // Animate background starfield with lensing
        const starPositions = starfield.geometry.attributes.position.array;
        for (let i = 0; i < particles; i++) {
            let i3 = i * 3;
            let data = starData[i];

            data.angle += data.speed * delta * 5;

            let x = Math.cos(data.angle) * data.radius;
            let z = Math.sin(data.angle) * data.radius;

            let distSq = x*x + z*z;
            let warpFactor = 5.0;
            let y = data.baseY - warpFactor / Math.max(1.0, distSq);

            starPositions[i3] = x;
            starPositions[i3+1] = y;
            starPositions[i3+2] = z;
        }
        starfield.geometry.attributes.position.needsUpdate = true;

        // Mouse camera movement
        camera.position.x += (mouseX * 2.0 - camera.position.x) * 0.02;
        camera.position.y += (-mouseY * 2.0 - camera.position.y) * 0.02 + 0.0005; // Gentle upward drift
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Animation Control ---
    const animControlButton = document.getElementById('animation-control');
    const pauseIcon = document.getElementById('pause-icon');
    const playIcon = document.getElementById('play-icon');

    animControlButton.addEventListener('click', () => {
        isAnimationRunning = !isAnimationRunning;
        if (isAnimationRunning) {
            pauseIcon.classList.remove('hidden');
            playIcon.classList.add('hidden');
            animate(); // Restart animation
        } else {
            pauseIcon.classList.add('hidden');
            playIcon.classList.remove('hidden');
        }
    });

    // --- Mobile Menu ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOpenIcon = document.getElementById('menu-open-icon');
    const menuCloseIcon = document.getElementById('menu-close-icon');

    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        menuOpenIcon.classList.toggle('hidden');
        menuCloseIcon.classList.toggle('hidden');
    });

    // --- Smooth Scrolling & Active Nav Link ---
    const sections = document.querySelectorAll('section[id]');
    const desktopNavLinks = document.querySelectorAll('#desktop-nav .nav-link');

    const activateNavLink = (id) => {
        if(!id) return;
        desktopNavLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                activateNavLink(entry.target.id);
            }
        });
    }, { rootMargin: '-40% 0px -60% 0px' });

    sections.forEach(section => {
        if(section.id) sectionObserver.observe(section);
    });

    const allNavLinks = document.querySelectorAll('a[href^="#"]');
    allNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
            if (!mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                menuOpenIcon.classList.remove('hidden');
                menuCloseIcon.classList.add('hidden');
            }
        });
    });

    // --- Section Fade-in Animation ---
    const fadeSections = document.querySelectorAll('.section-fade-in');
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    fadeSections.forEach(section => { fadeObserver.observe(section); });

    // --- Timeline Animation ---
    const timelineItems = document.querySelectorAll('.timeline-item');
    const timelineObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 150);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    timelineItems.forEach(item => {
        timelineObserver.observe(item);
    });

    // --- Gemini API Integration ---
    let apiKey = ""; // Canvas will provide this

    const modal = document.getElementById('ai-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');

    document.querySelectorAll('.ai-insights-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const projectCard = e.target.closest('.flex-col');
            const title = projectCard.querySelector('[data-project-title]').textContent;
            const description = projectCard.querySelector('[data-project-desc]').textContent;

            modal.classList.remove('hidden');
            modalContent.innerHTML = '<div class="flex justify-center items-center h-48"><div class="loader"></div></div>';

            const prompt = `
                You are a senior AI engineering manager reviewing a portfolio project.
                Based on the project title and description below, provide a detailed analysis.
                Format your response in Markdown with clear headings.

                Include these sections:
                ### Potential Technical Architecture
                Suggest a plausible tech stack and architecture.

                ### Key Challenges
                Describe 2-3 technical or ethical challenges.

                ### Business Impact & Scalability
                Explain the business value and how it could scale.

                **Project Title:** ${title.trim()}
                **Description:** ${description.trim()}
            `;

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            try {
                const payload = { contents: [{ parts: [{ text: prompt }] }] };
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API call failed: ${response.status}`);
                }

                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate insights.";

                // Basic Markdown to HTML conversion
                 let html = text
                    .replace(/### (.*)/g, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
                    .replace(/\*\*(.*)\*\*/g, '<strong class="text-sky-300">$1</strong>')
                    .replace(/^\* (.*)/gm, '<li>$1</li>')
                    .replace(/(\r\n|\n|\r)/gm, "<br>")
                    .replace(/<br><li>/g, '<li>')
                    .replace(/<\/li><br>/g, '</li>');

                html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>').replace(/<\/ul><br><ul>/g, '');


                modalContent.innerHTML = `<div class="prose-custom">${html}</div>`;

            } catch (error) {
                console.error("Gemini API Error:", error);
                modalContent.innerHTML = `<p class="text-red-400">An error occurred. Please check the console.</p>`;
            }
        });
    });

    closeModalBtn.addEventListener('click', () => { modal.classList.add('hidden'); });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.add('hidden'); } });

    // --- Custom Cursor ---
    const cursor = document.querySelector('.custom-cursor');
    if (cursor) {
        document.addEventListener('mousemove', e => {
            cursor.setAttribute("style", "top: " + (e.pageY - window.scrollY) + "px; left: " + e.pageX + "px;")
        });

        document.querySelectorAll('a, button, .glassmorphism, .skill-tag').forEach(el => {
            el.addEventListener('mouseover', () => {
                cursor.classList.add('pointer');
            });
            el.addEventListener('mouseout', () => {
                cursor.classList.remove('pointer');
            });
        });
    }

    // --- Contact Form ---
    const contactForm = document.getElementById('contact-form');
    const formFeedback = document.getElementById('form-feedback');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitButton = contactForm.querySelector('button[type="submit"]');

            // Simulate sending
            formFeedback.textContent = 'Sending...';
            formFeedback.classList.add('text-sky-400');
            formFeedback.classList.remove('text-green-400', 'text-red-400');
            submitButton.disabled = true;

            setTimeout(() => {
                // Simulate success
                formFeedback.textContent = 'Thank you for your message! I\'ll get back to you soon.';
                formFeedback.classList.add('text-green-400');
                formFeedback.classList.remove('text-sky-400');
                contactForm.reset();
                submitButton.disabled = false;
            }, 1500);
        });
    }
});