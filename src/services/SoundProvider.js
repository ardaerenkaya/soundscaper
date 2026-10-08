/**
 * Base abstraction for any sound provider (Freesound, Local, etc.)
 */
export class SoundProvider {
  /**
   * Search for sounds based on keywords and options.
   * @param {string} queryKeywords
   * @param {Object} options - { maxResults, durationRange, etc }
   * @returns {Promise<Array<Object>>} Array of standardized sound objects
   */
  async search(queryKeywords, options = {}) {
    throw new Error('search() not implemented by provider');
  }

  /**
   * Get acoustically or semantically similar sounds to a given sound ID.
   * @param {string} soundId
   * @param {Object} options - { maxResults }
   * @returns {Promise<Array<Object>>} Array of standardized sound objects
   */
  async getSimilar(soundId, options = {}) {
    throw new Error('getSimilar() not implemented by provider');
  }
}
