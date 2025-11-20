const os = require('os');
const path = require('path');
const sinon = require('sinon');
const fs = require('fs');
const { existsSync, unlinkSync, mkdirSync } = fs;

// Test configuration
const TEMP_DIR_PATH = 'C:\\TEMP\\Path With Space';
const SCREENSHOT_FILENAME = 'screenshot-test.jpg';

/**
 * Creates the test directory if it doesn't exist
 * @returns {boolean} Whether directory setup was successful
 */
function setupTestDirectory() {
  try {
    if (!existsSync(TEMP_DIR_PATH)) {
      mkdirSync(TEMP_DIR_PATH, { recursive: true });
      console.log(`Directory created: ${TEMP_DIR_PATH}`);
    } else {
      console.log(`Directory already exists: ${TEMP_DIR_PATH}`);
    }
    return true;
  } catch (error) {
    console.error(`Error creating directory: ${error.message}`);
    return false;
  }
}

/**
 * Cleans up test resources
 * @param {string} fullFilePath - Path to the screenshot file
 */
function cleanupResources(fullFilePath) {
  try {
    // Clean up the screenshot file if it exists
    if (existsSync(fullFilePath)) {
      unlinkSync(fullFilePath);
      console.log(`Cleaned up screenshot file: ${fullFilePath}`);
    }
    
    // Check for file in current directory (in case it was created there)
    const currentDirPath = path.join(process.cwd(), SCREENSHOT_FILENAME);
    if (existsSync(currentDirPath)) {
      unlinkSync(currentDirPath);
      console.log(`Cleaned up screenshot file in current directory: ${currentDirPath}`);
    }
  } catch (cleanupError) {
    console.warn('Warning: Failed to clean up screenshot file:', cleanupError.message);
  }
}

/**
 * Tests screenshot functionality with paths containing spaces on Windows
 */
async function runTest() {
  console.log('Running: screenshot with mocked tmpdir path containing spaces on windows');
  
  // Skip test if not on Windows
  if (process.platform !== 'win32') {
    console.log('Not on Windows, skipping test');
    return;
  }
  
  // Setup test directory
  if (!setupTestDirectory()) {
    return;
  }

  // Mock os.tmpdir to return a path with spaces
  const tmpDirStub = sinon.stub(os, 'tmpdir').returns(TEMP_DIR_PATH);
  
  const screenshot = require('./');
  const fullFilePath = path.join(os.tmpdir(), SCREENSHOT_FILENAME);
  
  try {
    // Capture screenshot
    const screenshotPath = await screenshot({ filename: fullFilePath });
    console.log('Screenshot saved at:', screenshotPath);
    
    // Verify screenshot was created
    if (!existsSync(fullFilePath)) {
      throw new Error(`Screenshot file does not exist at path: ${fullFilePath}`);
    }
    
    console.log('✓ Test passed: Screenshot file exists at', fullFilePath);
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up resources
    // cleanupResources(fullFilePath);
    tmpDirStub.restore();
  }
}

// Run the test
runTest();
