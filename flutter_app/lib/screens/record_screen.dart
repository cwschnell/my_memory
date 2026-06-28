import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';

class RecordScreen extends StatefulWidget {
  const RecordScreen({super.key});
  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  bool _isUploading = false;
  String? _lastSummary;
  String? _statusMessage;

  Future<void> _toggleRecord() async {
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      setState(() => _statusMessage = 'Microphone permission denied');
      return;
    }

    if (_isRecording) {
      final path = await _recorder.stop();
      setState(() { 
        _isRecording = false; 
        _isUploading = true; 
        _statusMessage = 'Transcribing & summarizing on computer...'; 
      });

      if (path != null) {
        try {
          final recording = await ApiService.uploadAudio(File(path));
          setState(() {
            _isUploading = false;
            _lastSummary = recording.summary;
            _statusMessage = 'Saved! Summary: "${recording.summary}"';
          });
        } catch (e) {
          setState(() {
            _isUploading = false;
            _statusMessage = 'Error: ${e.toString()}';
          });
        }
      }
    } else {
      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/memo_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000),
        path: filePath,
      );
      setState(() { 
        _isRecording = true; 
        _lastSummary = null;
        _statusMessage = 'Recording voice memo... Tap to stop'; 
      });
    }
  }

  @override
  void dispose() {
    _recorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E3A8A),
        elevation: 0,
        title: const Text('🧠 My Memory', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              GestureDetector(
                onTap: _isUploading ? null : _toggleRecord,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isRecording
                      ? const Color(0xFFDC2626)
                      : _isUploading
                        ? Colors.grey
                        : const Color(0xFF2563EB),
                    boxShadow: [
                      BoxShadow(
                        color: (_isRecording ? Colors.red : Colors.blue).withOpacity(0.3),
                        blurRadius: 30,
                        spreadRadius: 6,
                      )
                    ],
                  ),
                  child: Icon(
                    _isUploading
                      ? Icons.cloud_upload
                      : _isRecording
                        ? Icons.stop
                        : Icons.mic,
                    size: 72,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              if (_isUploading)
                const CircularProgressIndicator(color: Color(0xFF2563EB)),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  _statusMessage ?? 'Tap the microphone to record a memory',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                ),
              ),
              if (_lastSummary != null) ...[
                const SizedBox(height: 28),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 32),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Column(
                    children: [
                      const Text('💡 3-Word Summary', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Text(
                        _lastSummary!,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ]
            ],
          ),
        ),
      ),
    );
  }
}
