// vite.config.js
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split("\\").join("/");
          if (normalizedId.includes("/node_modules/")) {
            if (normalizedId.includes("/lucide-react/")) {
              return "vendor-icons";
            }
            if (normalizedId.includes("/jspdf/")) {
              return "vendor-jspdf";
            }
            if (normalizedId.includes("/html2canvas/")) {
              return "vendor-html2canvas";
            }
            if (normalizedId.includes("/dompurify/")) {
              return "vendor-dompurify";
            }
            return "vendor";
          }
          if (normalizedId.includes("/src/module-packs/")) {
            return "module-packs";
          }
          if (normalizedId.includes("/src/data/")) {
            return "app-data";
          }
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgIHNlcnZlcjoge1xuICAgICAgICBwb3J0OiA1MTczLFxuICAgICAgICBwcm94eToge1xuICAgICAgICAgICAgJy9hcGknOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg3JyxcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRJZCA9IGlkLnNwbGl0KCdcXFxcJykuam9pbignLycpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoJy9ub2RlX21vZHVsZXMvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoJy9sdWNpZGUtcmVhY3QvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1pY29ucyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKCcvanNwZGYvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1qc3BkZic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKCcvaHRtbDJjYW52YXMvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1odG1sMmNhbnZhcyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKCcvZG9tcHVyaWZ5LycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItZG9tcHVyaWZ5JztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAndmVuZG9yJztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkSWQuaW5jbHVkZXMoJy9zcmMvbW9kdWxlLXBhY2tzLycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ21vZHVsZS1wYWNrcyc7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZElkLmluY2x1ZGVzKCcvc3JjL2RhdGEvJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnYXBwLWRhdGEnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNKLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNILFFBQVE7QUFBQSxRQUNKLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNsQjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDSCxlQUFlO0FBQUEsTUFDWCxRQUFRO0FBQUEsUUFDSixhQUFhLElBQUk7QUFDYixnQkFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLEVBQUUsS0FBSyxHQUFHO0FBRTVDLGNBQUksYUFBYSxTQUFTLGdCQUFnQixHQUFHO0FBQ3pDLGdCQUFJLGFBQWEsU0FBUyxnQkFBZ0IsR0FBRztBQUN6QyxxQkFBTztBQUFBLFlBQ1g7QUFDQSxnQkFBSSxhQUFhLFNBQVMsU0FBUyxHQUFHO0FBQ2xDLHFCQUFPO0FBQUEsWUFDWDtBQUNBLGdCQUFJLGFBQWEsU0FBUyxlQUFlLEdBQUc7QUFDeEMscUJBQU87QUFBQSxZQUNYO0FBQ0EsZ0JBQUksYUFBYSxTQUFTLGFBQWEsR0FBRztBQUN0QyxxQkFBTztBQUFBLFlBQ1g7QUFDQSxtQkFBTztBQUFBLFVBQ1g7QUFFQSxjQUFJLGFBQWEsU0FBUyxvQkFBb0IsR0FBRztBQUM3QyxtQkFBTztBQUFBLFVBQ1g7QUFFQSxjQUFJLGFBQWEsU0FBUyxZQUFZLEdBQUc7QUFDckMsbUJBQU87QUFBQSxVQUNYO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
