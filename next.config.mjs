/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      // Added Cloudinary Hostname
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        // pathname: '/**', // You can be more specific if needed
      },
    ],
  },
};

export default nextConfig; 