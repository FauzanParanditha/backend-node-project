import logger from "./logger.js";

export let serverIsClosing = false;
export let activeTask = 0;

export function incrementActiveTask() {
    activeTask++;
    logger.debug(`Active task increment. Current count: ${activeTask}`);
}

export function decrementActiveTask() {
    activeTask--;
    logger.debug(`Active task decremented. Current count: ${activeTask}`);
}
