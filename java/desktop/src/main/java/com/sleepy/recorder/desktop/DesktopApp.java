package com.sleepy.recorder.desktop;

import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.stage.Stage;

/**
 * Main JavaFX application for desktop
 */
public class DesktopApp extends Application {

    @Override
    public void start(Stage primaryStage) throws Exception {
        FXMLLoader loader = new FXMLLoader(getClass().getResource("/main.fxml"));
        Scene scene = new Scene(loader.load(), 800, 600);

        primaryStage.setTitle("Sleepy Recorder");
        primaryStage.setScene(scene);
        primaryStage.show();
    }

    @Override
    public void stop() throws Exception {
        // Cleanup
        MainController controller = MainController.getInstance();
        if (controller != null) {
            controller.cleanup();
        }
        super.stop();
    }

    public static void main(String[] args) {
        launch(args);
    }
}
