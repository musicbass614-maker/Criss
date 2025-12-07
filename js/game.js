// Three.js değişkenleri
let scene, camera, renderer, objModel;
let isRotating = false;
let currentScale = 1;

// OBJ ve MTL loader'ları
let OBJLoader, MTLLoader;

function init() {
    // Sahneyi oluştur
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Mavi gökyüzü
    
    // Kamerayı ayarla
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 5);
    
    // Renderer oluştur
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Loader'ları başlat
    OBJLoader = new THREE.OBJLoader();
    MTLLoader = new THREE.MTLLoader();
    
    // Işıklar
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Zemin
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x228B22 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // OBJ modelini yükle
    loadOBJModel();
    
    // Kontroller
    setupControls();
    
    // Animasyon döngüsü
    animate();
    
    // Pencere boyutu değişince
    window.addEventListener('resize', onWindowResize);
}

function loadOBJModel() {
    // NOT: OBJ dosyanızı 'models' klasörüne koyun
    // AIDE'da: Sağ tık > New Folder > 'models'
    
    // Önce MTL materyal dosyasını yükle (eğer varsa)
    MTLLoader.load(
        'models/your_model.mtl', // MTL dosya yolunuz
        function(materials) {
            materials.preload();
            
            // OBJ'yi materyallerle yükle
            OBJLoader.setMaterials(materials);
            OBJLoader.load(
                'models/your_model.obj', // OBJ dosya yolunuz
                function(object) {
                    objModel = object;
                    
                    // Modeli sahneye ekle
                    scene.add(objModel);
                    
                    // Gölge özellikleri
                    objModel.traverse(function(child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    // Modeli merkezle
                    const box = new THREE.Box3().setFromObject(objModel);
                    const center = box.getCenter(new THREE.Vector3());
                    objModel.position.sub(center);
                    
                    // Bilgi metnini güncelle
                    document.getElementById('info').innerHTML = 
                        'OBJ Yüklendi!<br>' +
                        'Kontrolleri kullanın';
                },
                // Yükleme ilerlemesi
                function(xhr) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    document.getElementById('info').innerHTML = 
                        `Yükleniyor: ${percent}%`;
                },
                // Hata durumu
                function(error) {
                    console.error('OBJ yükleme hatası:', error);
                    document.getElementById('info').innerHTML = 
                        'Hata! Model yüklenemedi<br>' +
                        'Dosya yolunu kontrol edin';
                    
                    // Test için basit bir küp göster
                    showTestCube();
                }
            );
        },
        // MTL yükleme hatası
        function() {
            // MTL yoksa, OBJ'yi materyalsiz yükle
            loadOBJWithoutMTL();
        }
    );
}

function loadOBJWithoutMTL() {
    OBJLoader.load(
        'models/your_model.obj',
        function(object) {
            objModel = object;
            
            // Varsayılan materyal ekle
            const material = new THREE.MeshLambertMaterial({ 
                color: 0x00ff00,
                wireframe: true
            });
            
            objModel.traverse(function(child) {
                if (child.isMesh) {
                    child.material = material;
                    child.castShadow = true;
                }
            });
            
            scene.add(objModel);
            document.getElementById('info').innerHTML = 'OBJ Yüklendi (Wireframe)';
        },
        function() {
            // OBJ yüklenemediyse test küpü göster
            showTestCube();
        }
    );
}

function showTestCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    objModel = new THREE.Mesh(geometry, material);
    objModel.position.y = 0.5;
    scene.add(objModel);
    
    document.getElementById('info').innerHTML = 
        'Test Küpü Yüklendi<br>' +
        'OBJ dosyanızı models/ klasörüne koyun';
}

function setupControls() {
    // Dokunmatik kontroller
    let touchStartX = 0;
    let touchStartY = 0;
    
    renderer.domElement.addEventListener('touchstart', function(event) {
        event.preventDefault();
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
    });
    
    renderer.domElement.addEventListener('touchmove', function(event) {
        event.preventDefault();
        if (!objModel) return;
        
        const touchX = event.touches[0].clientX;
        const touchY = event.touches[0].clientY;
        
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        
        objModel.rotation.y += deltaX * 0.01;
        objModel.rotation.x += deltaY * 0.01;
        
        touchStartX = touchX;
        touchStartY = touchY;
    });
}

// Kontrol fonksiyonları
function rotateModel() {
    if (!objModel) return;
    isRotating = !isRotating;
}

function scaleUp() {
    if (!objModel) return;
    currentScale += 0.2;
    objModel.scale.set(currentScale, currentScale, currentScale);
}

function scaleDown() {
    if (!objModel) return;
    currentScale = Math.max(0.2, currentScale - 0.2);
    objModel.scale.set(currentScale, currentScale, currentScale);
}

function resetModel() {
    if (!objModel) return;
    objModel.rotation.set(0, 0, 0);
    objModel.scale.set(1, 1, 1);
    currentScale = 1;
    isRotating = false;
}

function animate() {
    requestAnimationFrame(animate);
    
    // Model döndürme
    if (objModel && isRotating) {
        objModel.rotation.y += 0.01;
    }
    
    // Kamera hafif hareketi
    camera.position.x = Math.sin(Date.now() * 0.001) * 3;
    camera.lookAt(0, 0, 0);
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Sayfa yüklendiğinde başlat
window.onload = init;
