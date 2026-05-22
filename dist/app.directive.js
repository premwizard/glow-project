angular.module('antigravityApp')
  .directive('antigravityCanvas', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const particlesScale = isMobile ? 0.35 : 0.59;
        const density = isMobile ? 120 : 230;

        const sceneInstance = new AntigravityScene({
          canvas: element[0],
          container: document.body,
          theme: "light",
          particlesScale: particlesScale,
          density: density,
          ringWidth: 0.006,
          ringWidth2: 0.107,
          ringDisplacement: 0.62,
          interactive: true
        });
        
        let animationFrameId;
        function loop() {
          animationFrameId = requestAnimationFrame(loop);
          sceneInstance.render();
        }
        loop();

        // Clean up resources on directive destroy
        scope.$on('$destroy', function() {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          sceneInstance.kill();
        });
      }
    };
  });
