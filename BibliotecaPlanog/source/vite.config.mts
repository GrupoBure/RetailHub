import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:import.meta.dirname,base:'/RetailHub/BibliotecaPlanog/',plugins:[react()],server:{allowedHosts:['terminal.local']},build:{outDir:'dist',emptyOutDir:true,assetsDir:'assets'}});
