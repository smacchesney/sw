"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerConnectionOptions = exports.QueueName = void 0;
exports.getQueue = getQueue;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
// Ensure Redis URL is provided via environment variables
if (!process.env.REDIS_URL) {
    throw new Error('Missing REDIS_URL environment variable');
}
// Reusable connection options
const connectionOptions = {
    connection: new ioredis_1.default(process.env.REDIS_URL, {
        maxRetriesPerRequest: null, // Needed for BullMQ
    }),
};
// Define queue names centrally
var QueueName;
(function (QueueName) {
    QueueName["StoryGeneration"] = "story-generation";
    // Add other queue names here if needed
})(QueueName || (exports.QueueName = QueueName = {}));
// Function to create or get a queue instance
const queues = new Map();
function getQueue(name) {
    if (!queues.has(name)) {
        const newQueue = new bullmq_1.Queue(name, connectionOptions);
        queues.set(name, newQueue);
    }
    return queues.get(name);
}
// Export connection options for worker configuration
exports.workerConnectionOptions = connectionOptions;
// Example Usage (in API route or server action):
// import { getQueue, QueueName } from './lib/queue';
// const storyQueue = getQueue(QueueName.StoryGeneration);
// await storyQueue.add('generate-story-job', { userId: '...', bookId: '...', inputs: { ... } });
// Example Worker setup (in a separate worker process file):
// import { Worker } from 'bullmq';
// import { QueueName, workerConnectionOptions } from './lib/queue';
// const worker = new Worker(QueueName.StoryGeneration, async job => {
//   console.log('Processing job:', job.id, job.data);
//   // Call AI generation logic here
// }, workerConnectionOptions); 
