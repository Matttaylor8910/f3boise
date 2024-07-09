import {Component, OnInit} from '@angular/core';
import {AuthService} from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  email = '';
  password = '';

  constructor(
      private readonly authService: AuthService,
  ) {}

  ngOnInit() {}

  signUp() {
    this.authService.signUpWithEmailAndPassword(this.email, this.password);
  }

  signIn() {
    this.authService.loginWithEmailAndPassword(this.email, this.password);
  }
}
